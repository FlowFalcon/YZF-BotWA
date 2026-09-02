import { lstat, mkdir, readdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'

export const MAX_PLUGIN_SOURCE_BYTES = 256 * 1024
const PLUGIN_NAME = /^[a-z0-9][a-z0-9-]*$/
const ALLOWED_PACKAGES = new Set(['zapo-js'])
const ALLOWED_BUILTINS = new Set(['node:crypto', 'node:fs', 'node:stream'])
const FORBIDDEN_GLOBALS = new Set(['eval', 'Function', 'process', 'globalThis', 'require', 'createRequire'])

function pluginPaths(projectRoot: string, name: string): { staging: string; target: string } {
  const project = path.resolve(projectRoot)
  return {
    staging: path.join(project, '.runtime', 'plugin-staging', `${name}.ts`),
    target: path.join(project, 'plugins', `${name}.ts`),
  }
}

async function safeDirectory(projectRoot: string, directory: string, label: string): Promise<string> {
  const project = await realpath(projectRoot)
  if (project !== path.resolve(projectRoot)) throw new Error(`Symlink project ${label} ditolak.`)
  const relative = path.relative(project, directory)
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Path ${label} keluar project ditolak.`)
  let current = project
  for (const component of relative.split(path.sep)) {
    current = path.join(current, component)
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new Error(`Symlink ${label} ditolak.`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      await mkdir(current, { mode: 0o700 })
    }
  }
  if (await realpath(current) !== current) throw new Error(`Symlink ${label} ditolak.`)
  return current
}

export async function stagePluginSource(projectRoot: string, name: string, source: string): Promise<string> {
  if (!PLUGIN_NAME.test(name)) throw new Error(`Nama plugin invalid: ${name}.`)
  if (Buffer.byteLength(source) > MAX_PLUGIN_SOURCE_BYTES) throw new Error(`Source plugin terlalu besar: ${name}.ts.`)
  const { staging } = pluginPaths(projectRoot, name)
  await safeDirectory(projectRoot, path.dirname(staging), 'staging')
  const temporary = `${staging}.${process.pid}.${crypto.randomUUID()}.tmp`
  try {
    await writeFile(temporary, source, { mode: 0o600, flag: 'wx' })
    await rename(temporary, staging)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }
  return staging
}

export async function promoteStagedPlugin(
  projectRoot: string,
  name: string,
  stagedPath: string,
  validate: (stagedPath: string) => Promise<void>,
): Promise<string> {
  if (!PLUGIN_NAME.test(name)) throw new Error(`Nama plugin invalid: ${name}.`)
  const { staging, target } = pluginPaths(projectRoot, name)
  if (path.resolve(stagedPath) !== staging) throw new Error('Path staging plugin invalid.')
  await safeDirectory(projectRoot, path.dirname(staging), 'staging')
  if ((await lstat(staging)).isSymbolicLink()) throw new Error('Symlink staging plugin ditolak.')
  await validate(staging)
  await safeDirectory(projectRoot, path.dirname(target), 'plugins')
  await rename(staging, target)
  return target
}

function isPure(node: ts.Expression): boolean {
  if (ts.isLiteralExpression(node) || node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword || node.kind === ts.SyntaxKind.NullKeyword) return true
  if (ts.isIdentifier(node)) return !FORBIDDEN_GLOBALS.has(node.text)
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return true
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node)) return isPure(node.expression)
  if (ts.isPrefixUnaryExpression(node)) return isPure(node.operand)
  if (ts.isArrayLiteralExpression(node)) return node.elements.every((element) => ts.isSpreadElement(element) ? false : isPure(element))
  if (ts.isObjectLiteralExpression(node)) return node.properties.every((property) => {
    if (ts.isPropertyAssignment(property)) return !ts.isComputedPropertyName(property.name) && isPure(property.initializer)
    return ts.isMethodDeclaration(property) || ts.isShorthandPropertyAssignment(property)
  })
  return false
}

async function validateSource(source: string, file: string, root: string, project: string): Promise<void> {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const reject = (reason: string): never => { throw new Error(`${reason}: ${path.relative(root, file)}.`) }

  function visit(node: ts.Node): void {
    if (ts.isIdentifier(node) && FORBIDDEN_GLOBALS.has(node.text)) reject(`${node.text} ditolak`)
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'constructor') reject('Akses constructor ditolak')
    if (ts.isElementAccessExpression(node)) reject('Computed member access ditolak')
    if (ts.isClassStaticBlockDeclaration(node)) reject('Class static block ditolak')
    if (ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) reject('Getter/setter ditolak')
    if (ts.canHaveDecorators(node) && (ts.getDecorators(node)?.length ?? 0) > 0) reject('Decorator ditolak')
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) reject('Dynamic import ditolak')
    if (ts.isTaggedTemplateExpression(node)) reject('Tagged template ditolak')
    ts.forEachChild(node, visit)
  }

  for (const statement of parsed.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const specifier = statement.moduleSpecifier.text
      if (specifier.startsWith('node:') && !ALLOWED_BUILTINS.has(specifier)) reject(`Import ${specifier} tidak diizinkan`)
      if (!specifier.startsWith('.') && !specifier.startsWith('node:') && !ALLOWED_PACKAGES.has(specifier)) reject(`Import ${specifier} tidak diizinkan`)
      if (specifier.startsWith('.')) {
        const lexical = path.resolve(path.dirname(file), specifier.replace(/\.js$/, '.ts'))
        if (lexical !== project && !lexical.startsWith(`${project}${path.sep}`)) reject('Import keluar project ditolak')
        try {
          const resolved = await realpath(lexical)
          const realProject = await realpath(project)
          if (resolved !== realProject && !resolved.startsWith(`${realProject}${path.sep}`)) reject('Import symlink/keluar project ditolak')
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
      }
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (declaration.initializer !== undefined && !isPure(declaration.initializer)) reject('Top-level initializer ditolak')
      }
    } else if (!ts.isExportAssignment(statement) && !ts.isFunctionDeclaration(statement) && !ts.isClassDeclaration(statement) && !ts.isInterfaceDeclaration(statement) && !ts.isTypeAliasDeclaration(statement)) {
      reject('Top-level side effect ditolak')
    }
    visit(statement)
  }
}

export async function validatePluginSources(directory: string, projectRoot: string): Promise<string[]> {
  const root = path.resolve(directory)
  const project = path.resolve(projectRoot)
  if (root !== path.join(project, 'plugins')) throw new Error('Plugin directory harus <project>/plugins.')
  if (await realpath(root) !== root || await realpath(project) !== project) throw new Error('Symlink root plugin/project ditolak.')

  const files: string[] = []
  async function scan(current: string): Promise<void> {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      const stat = await lstat(full)
      if (stat.isSymbolicLink()) throw new Error(`Symlink plugin ditolak: ${path.relative(root, full)}.`)
      if (entry.isDirectory()) await scan(full)
      else if (entry.isFile()) {
        if (!entry.name.endsWith('.ts') || entry.name.endsWith('.d.ts')) throw new Error(`Hanya source plugin .ts yang diizinkan: ${path.relative(root, full)}.`)
        if (stat.size > MAX_PLUGIN_SOURCE_BYTES) throw new Error(`Source plugin terlalu besar: ${path.relative(root, full)}.`)
        await validateSource(await readFile(full, 'utf8'), full, root, project)
        files.push(path.relative(root, full))
      }
    }
  }
  await scan(root)
  return files.sort()
}
