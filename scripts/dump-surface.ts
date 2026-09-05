import path from 'node:path'

import { loadCommands } from '../lib/commands/loader.js'
import { validatePluginSources } from '../lib/commands/plugin-policy.js'

const ROOT = path.resolve(import.meta.dirname, '..')

const registry = await loadCommands(path.join(ROOT, 'plugins'), { extension: '.ts' })
const names = registry.list().map((command) => command.name).sort()
const files = await validatePluginSources(path.join(ROOT, 'plugins'), ROOT)

process.stdout.write(`NAMES=${JSON.stringify(names)}\n`)
process.stdout.write(`FILES=${JSON.stringify(files)}\n`)
