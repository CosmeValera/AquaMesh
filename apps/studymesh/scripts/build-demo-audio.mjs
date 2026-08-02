/**
 * Synthesises the podcast MP3 for already-captured demo guides.
 *
 * The guide capture (build-demo-guide.mjs) can run with --skip-audio, which
 * writes the podcast page with its script, chapters and transcript but no
 * audio. This script fills that gap without touching the captured content:
 * it reads the frozen podcast script straight out of <camelSlug>.data.json
 * and re-runs only the text-to-speech stage.
 *
 * Usage, from the repository root:
 *   node --use-system-ca --import tsx apps/studymesh/scripts/build-demo-audio.mjs
 *   node --use-system-ca --import tsx apps/studymesh/scripts/build-demo-audio.mjs why-you-forget
 *
 * --use-system-ca matters on machines whose HTTPS traffic is inspected by a
 * corporate proxy or antivirus: without it the TLS handshake to the speech API
 * fails with SELF_SIGNED_CERT_IN_CHAIN.
 *
 * Existing MP3s are left alone unless --force is passed.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(scriptDir, '..')
const guidesDir = resolve(appDir, 'src/demo/guides')
const audioDir = resolve(appDir, 'public/demo/audio')

const args = process.argv.slice(2)
const force = args.includes('--force')
const requestedSlugs = args.filter((arg) => !arg.startsWith('--'))

const log = (message) => {
  console.log(`[demo-audio] ${message}`)
}

const toCamelSlug = (slug) =>
  slug.replace(/-([a-z0-9])/g, (_match, character) => character.toUpperCase())

const findPodcastProps = (value) => {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findPodcastProps(entry)
      if (found) {
        return found
      }
    }
    return null
  }

  if (!value || typeof value !== 'object') {
    return null
  }

  if (value.type === 'PodcastBlock' && value.props?.podcast) {
    return value.props.podcast
  }

  for (const entry of Object.values(value)) {
    const found = findPodcastProps(entry)
    if (found) {
      return found
    }
  }

  return null
}

const main = async () => {
  const { loadLocalApiEnv } = await import('../../../api/local-env.ts')
  loadLocalApiEnv()

  const { DEMO_GUIDES } = await import('../src/demo/demoGuides.ts')
  const hosted = await import('../../../api/hosted-ai.ts')

  const targets = requestedSlugs.length
    ? DEMO_GUIDES.filter((guide) => requestedSlugs.includes(guide.slug))
    : DEMO_GUIDES

  if (!targets.length) {
    throw new Error(`no demo guide matches: ${requestedSlugs.join(', ')}`)
  }

  mkdirSync(audioDir, { recursive: true })

  let written = 0

  for (const guide of targets) {
    const target = resolve(audioDir, `${guide.slug}.mp3`)

    if (existsSync(target) && !force) {
      log(`${guide.slug}: MP3 already present, skipping`)
      continue
    }

    const dataPath = resolve(guidesDir, `${toCamelSlug(guide.slug)}.data.json`)

    if (!existsSync(dataPath)) {
      log(`${guide.slug}: no captured data, skipping`)
      continue
    }

    const data = JSON.parse(readFileSync(dataPath, 'utf8'))
    const podcast = findPodcastProps(data.bonusPages)

    if (!podcast?.transcriptTurns?.length) {
      log(`${guide.slug}: no podcast script in the capture, skipping`)
      continue
    }

    if (podcast.audioPath !== `/demo/audio/${guide.slug}.mp3`) {
      throw new Error(
        `${guide.slug}: captured audioPath is ${podcast.audioPath}, expected /demo/audio/${guide.slug}.mp3`,
      )
    }

    log(`${guide.slug}: synthesising ${podcast.transcriptTurns.length} turns`)

    const audio = await hosted.generatePodcastAudioFromScript(
      {
        title: podcast.title,
        description: podcast.description,
        transcriptTurns: podcast.transcriptTurns,
        chapters: podcast.chapters || [],
      },
      data.studyPath?.contentLanguage,
    )

    writeFileSync(target, audio.audioBuffer)
    written += 1
    log(
      `${guide.slug}: wrote ${target} (${Math.round(
        audio.audioBuffer.length / 1024,
      )} KB)`,
    )
  }

  log(`done, ${written} MP3(s) written`)
}

await main()
