import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const PLUGIN_DIR = 'plugins'

async function files(directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (path.basename(full) !== PLUGIN_DIR) continue
      result.push(...await files(full))
    } else if (entry.isFile() && entry.name.endsWith('.js')) result.push(full)
  }
  return result.sort()
}

for (const file of await files(process.argv[2])) {
  const loaded = await import(pathToFileURL(file).href)
  const command = loaded.default
  if (typeof command !== 'object' || command === null || typeof command.run !== 'function') {
    throw new Error(`Invalid command export: ${file}`)
  }
}
