import Module from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { JSDOM } from 'jsdom'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../../..')

const eldEntry = resolve(
  repoRoot,
  'node_modules/eld/src/entries/static.extrasmall.js',
)
const resolveFilename = Module._resolveFilename
Module._resolveFilename = function (request, ...rest) {
  if (request === 'eld/extrasmall') {
    return eldEntry
  }

  return resolveFilename.call(this, request, ...rest)
}

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://demo.local/',
})

const define = (name, value) => {
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true,
  })
}

define('window', dom.window)
define('document', dom.window.document)
define('navigator', dom.window.navigator)
define('localStorage', dom.window.localStorage)
define('sessionStorage', dom.window.sessionStorage)
define('CustomEvent', dom.window.CustomEvent)
define('Event', dom.window.Event)
define('matchMedia', () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
}))

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://demo.invalid'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'demo-anon-key'

process.chdir(repoRoot)

const generation = await import('../../src/studyGuides/generation.ts')
console.log('generation ok', Object.keys(generation).length)

const storage = await import('../../src/studyGuides/storage.ts')
console.log('storage ok', typeof storage.createStudyGuideRecord)

const hosted = await import('../../../../api/hosted-ai.ts')
console.log('hosted ok', Object.keys(hosted).join(','))

const lang = await import('../../src/language/contentLanguage.ts')
console.log(
  'lang',
  JSON.stringify(
    lang.resolveContentLanguage({
      text: 'Teach me why I forget most of what I study and how spaced repetition fixes it. I already practise a musical instrument.',
    }),
  ),
)

const provider = await import('../../src/quickCreate/ai/provider.ts')
console.log('provider ok', typeof provider.generateStudyPathWithAi)

const settings = await import('../../src/quickCreate/ai/settings.ts')
console.log('settings', JSON.stringify(settings.readQuickCreateAiSettings()))
