import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

let loaded = false

const parseEnvLine = (line: string): [string, string] | null => {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) {
    return null
  }

  const separatorIndex = trimmed.indexOf('=')
  if (separatorIndex <= 0) {
    return null
  }

  const key = trimmed.slice(0, separatorIndex).trim()
  let value = trimmed.slice(separatorIndex + 1).trim()

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1)
  }

  return key ? [key, value] : null
}

const loadEnvFile = (path: string): void => {
  readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .forEach((line) => {
      const entry = parseEnvLine(line)
      if (!entry) {
        return
      }

      const [key, value] = entry
      if (!process.env[key]) {
        process.env[key] = value
      }
    })
}

export const loadLocalApiEnv = (): void => {
  if (loaded || process.env.NODE_ENV === 'production') {
    return
  }

  loaded = true

  const envPaths = [
    '.env.local',
    '.env',
    'apps/studymesh/.env.local',
    'apps/studymesh/.env',
  ]

  envPaths.forEach((envPath) => {
    const absolutePath = resolve(process.cwd(), envPath)
    if (existsSync(absolutePath)) {
      loadEnvFile(absolutePath)
    }
  })
}
