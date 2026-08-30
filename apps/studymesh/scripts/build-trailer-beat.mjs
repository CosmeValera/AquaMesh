/**
 * Builds the "one guide opens three more" trailer beat and splices it into the
 * landing trailer.
 *
 * The beat is designed, not screen-recorded. Raw screenshots pasted edge to edge
 * looked nothing like the rest of the cut, which frames the app in a rounded
 * white card on a periwinkle ground with a tilted chip label, and states its
 * message on a pastel gradient slide. So every frame here is an HTML slide
 * rendered through Playwright at 1920x1080 holding real screenshots, and the
 * palette is sampled straight out of the trailer frames kept in
 * readme_docs/trailer/reference/style-*.png.
 *
 * Usage, from the repository root:
 *   node apps/studymesh/scripts/build-trailer-beat.mjs beat
 *   node apps/studymesh/scripts/build-trailer-beat.mjs splice
 *   node apps/studymesh/scripts/build-trailer-beat.mjs install
 *
 * The beat carries the two clips written for it and nothing else. Do not add a
 * music bed lifted out of trailer.mp4: its audio has the trailer's own narration
 * baked in, so any slice of it drags another voice line into the beat.
 *
 * Intermediates go to %TEMP%/rabbithole-trailer (override with TRAILER_BUILD_DIR)
 * so nothing extra reaches the repo or dist/.
 */

import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(scriptDir, '..')
const repoRoot = resolve(appDir, '../..')
const referenceDir = resolve(repoRoot, 'readme_docs/trailer/reference')
const voiceDir = resolve(appDir, 'public/voice')
const trailerPath = resolve(appDir, 'public/videos/trailer.mp4')
const buildDir = resolve(
  process.env.TRAILER_BUILD_DIR || resolve(tmpdir(), 'rabbithole-trailer'),
)

const CANVAS_W = 1920
const CANVAS_H = 1080
const FPS = 30
// One frame, which is a cut. Used where a dissolve would soften a click.
const CUT = 1 / FPS
// The audio drops to -36 dBFS here and jumps back to -20 dB at 45.5, where the
// bunny outro starts on its own downbeat. Cutting in the trough hides the seam.
const SEAM = 45.0
const JOIN_FADE = 0.3
// The trailer without this beat is 57.4s; anything past this already carries it.
const SPLICED_MIN_DURATION = 60

// Sampled from the trailer's own frames: the periwinkle ground and chip of the
// "Chat with AI" card frame, and the pastel corners of the gradient slide.
const PALETTE = {
  ground: '#C1D7FF',
  chip: '#90AEE2',
  ink: '#1A1F30',
  accents: ['#1A56DB', '#0F766E', '#A21567'],
  gradient: [
    ['12% 8%', '#E3DCFB'],
    ['55% 0%', '#D2E8D1'],
    ['98% 6%', '#FEE1C1'],
    ['4% 96%', '#C5DEFF'],
    ['52% 100%', '#E5D5EB'],
    ['100% 96%', '#DDE6C9'],
  ],
}

/** Reference stills that need trimming before they can sit in a card. */
const CROPS = {
  donut: { file: '21-quiz-results-card.png', crop: [0, 8, 1017, 340] },
  quickStart: {
    file: '14-guide-dreams-quickstart.png',
    crop: [0, 0, 991, 330],
  },
  // One progress card, not the pair the screenshot happens to hold: two cards
  // under a shot that just said "Create 3 guides" reads as a miscount.
  building: { file: '10-creating-progress.png', crop: [0, 0, 500, 298] },
}

const SHOT_ZOOM = [1.0, 1.03]
// Pushing out instead of in, so consecutive card slides do not all drift the
// same way and the beat stops feeling like a slideshow.
const SHOT_ZOOM_OUT = [1.03, 1.0]

/**
 * Five app moments and a closing message. Not every screenshot that exists: the
 * beat has to say "you finished, three doors opened, they are being built, this
 * is what they look like, and every one starts from what you just learned".
 */
const SLIDES = [
  {
    name: 'quiz',
    dur: 1.8,
    zoom: SHOT_ZOOM,
    screen: { chip: 'Quiz complete', image: 'donut' },
  },
  {
    name: 'ideas',
    dur: 1.2,
    zoom: SHOT_ZOOM_OUT,
    screen: {
      chip: 'Three ways to go deeper',
      image: '05-ideas-none-selected-panel.png',
    },
  },
  // Cuts rather than dissolves in: three cards ticking over should feel clicked.
  {
    name: 'picked',
    dur: 1.2,
    cutIn: true,
    zoom: SHOT_ZOOM,
    screen: {
      chip: 'Three ways to go deeper',
      image: '04-ideas-three-selected-panel.png',
    },
  },
  {
    name: 'building',
    dur: 1.1,
    zoom: SHOT_ZOOM_OUT,
    screen: { chip: 'Building them for you', image: 'building' },
  },
  {
    name: 'quickstart',
    dur: 2.0,
    zoom: SHOT_ZOOM,
    screen: { chip: 'Every new guide', image: 'quickStart' },
  },
  // The message lands one row at a time. Rows that have not arrived keep their
  // space, so nothing reflows between the three renders.
  { name: 'message-1', dur: 0.5, fade: 0.3, message: { rows: 1 } },
  { name: 'message-2', dur: 0.5, fade: 0.2, message: { rows: 2 } },
  { name: 'message-3', dur: 2.9, fade: 0.2, message: { rows: 3 } },
]

const MESSAGE = {
  headline: 'Each one explained through what you already know.',
  via: 'via Caffeine and adenosine signaling',
  rows: ['Caffeine and dreams', 'Plan caffeine timing', 'Receptor blockers'],
}

const VOICE = [
  { file: 'v0_16-finish-a-guide-and-it-opens-three-more.mp3', at: 0.3 },
  {
    file: 'v0_17-each-one-explained-through-what-you-just-learned.mp3',
    at: 6.1,
  },
]

const run = (bin, args) => {
  const result = spawnSync(bin, args, { encoding: 'utf8' })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    const tail = String(result.stderr || '')
      .split('\n')
      .slice(-12)
      .join('\n')
    throw new Error(`${bin} failed (${result.status}):\n${tail}`)
  }

  return String(result.stdout || '').trim()
}

const ffmpeg = (args) =>
  run('ffmpeg', ['-y', '-hide_banner', '-v', 'error', ...args])

const durationOf = (path) =>
  Number(
    run('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'csv=p=0',
      path,
    ]),
  )

const stillPath = (file) => {
  const source = resolve(referenceDir, file)
  if (!existsSync(source)) {
    throw new Error(`Missing reference still: ${source}`)
  }

  return source
}

const renderCrops = () => {
  const cropped = {}
  Object.entries(CROPS).forEach(([key, spec]) => {
    const [x, y, w, h] = spec.crop
    const out = resolve(buildDir, `crop-${key}.png`)
    ffmpeg(['-i', stillPath(spec.file), '-vf', `crop=${w}:${h}:${x}:${y}`, out])
    cropped[key] = out
  })

  return cropped
}

// Inlined rather than linked: setContent leaves the page on about:blank, and a
// file:// image never loads from there.
const imageUrl = (name, cropped) => {
  const path = cropped[name] || stillPath(name)
  return `data:image/png;base64,${readFileSync(path).toString('base64')}`
}

const baseCss = `
  @import url('https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${CANVAS_W}px;
    height: ${CANVAS_H}px;
    overflow: hidden;
    font-family: 'Readex Pro', 'Segoe UI', system-ui, sans-serif;
    color: ${PALETTE.ink};
  }
  .stage {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`

/** The app framed the way the rest of the trailer frames it. */
const screenSlide = (slide, cropped) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
  ${baseCss}
  .stage { background: ${PALETTE.ground}; }
  .frame { position: relative; }
  .chip {
    position: absolute;
    top: -40px;
    left: 46px;
    transform: rotate(-1.4deg);
    background: ${PALETTE.chip};
    color: #fff;
    font-size: 34px;
    font-weight: 600;
    padding: 14px 32px 16px;
    border-radius: 16px;
    box-shadow: 0 10px 26px rgba(28, 40, 90, 0.18);
  }
  .card {
    background: #fff;
    border-radius: 22px;
    padding: 38px;
    box-shadow: 0 26px 60px rgba(28, 40, 90, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.8);
  }
  .card img { display: block; width: 1240px; height: auto; border-radius: 8px; }
</style></head>
<body><div class="stage"><div class="frame">
  <div class="chip">${slide.screen.chip}</div>
  <div class="card"><img src="${imageUrl(slide.screen.image, cropped)}"></div>
</div></div></body></html>`

/** The closing statement, on the gradient the trailer already uses. */
const messageSlide = (slide) => {
  const gradient = PALETTE.gradient
    .map(
      ([at, color]) =>
        `radial-gradient(80% 70% at ${at}, ${color} 0%, rgba(255,255,255,0) 62%)`,
    )
    .join(',\n      ')
  const rows = MESSAGE.rows
    .map(
      (title, index) => `
      <div class="row" style="--accent: ${
        PALETTE.accents[index]
      }; visibility: ${index < slide.message.rows ? 'visible' : 'hidden'}">
        <div class="bar"></div>
        <div>
          <div class="title">${title}</div>
          <div class="via">${MESSAGE.via}</div>
        </div>
      </div>`,
    )
    .join('')

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  ${baseCss}
  .stage {
    flex-direction: column;
    gap: 62px;
    padding: 0 210px;
    background:
      ${gradient},
      #E9E6F5;
  }
  h1 {
    font-size: 54px;
    font-weight: 700;
    letter-spacing: -0.6px;
    text-align: center;
    line-height: 1.2;
  }
  .list { display: flex; flex-direction: column; gap: 26px; width: 100%; }
  .row {
    display: flex;
    gap: 26px;
    align-items: stretch;
    background: #fff;
    border-radius: 18px;
    padding: 26px 34px;
    box-shadow: 0 14px 34px rgba(28, 40, 90, 0.12);
  }
  .bar { width: 7px; border-radius: 4px; background: var(--accent); }
  .title { font-size: 34px; font-weight: 500; }
  .via { font-size: 27px; font-weight: 600; color: var(--accent); margin-top: 6px; }
</style></head>
<body><div class="stage">
  <h1>${MESSAGE.headline}</h1>
  <div class="list">${rows}</div>
</div></body></html>`
}

/** Renders every slide to a PNG through headless Chromium. */
const renderSlides = async () => {
  const { chromium } = await import('playwright')
  const cropped = renderCrops()
  const browser = await chromium.launch()
  const page = await browser.newPage({
    viewport: { width: CANVAS_W, height: CANVAS_H },
    deviceScaleFactor: 1,
  })

  const rendered = []
  for (const slide of SLIDES) {
    const html = slide.message
      ? messageSlide(slide)
      : screenSlide(slide, cropped)
    await page.setContent(html, { waitUntil: 'networkidle' })
    // Web fonts settle a frame late; without this the first slide renders in
    // the fallback face and the type jumps mid-beat.
    await page.evaluate(() => document.fonts.ready)
    const out = resolve(buildDir, `slide-${slide.name}.png`)
    await page.screenshot({ path: out })
    rendered.push({ ...slide, image: out })
  }

  await browser.close()
  return rendered
}

/** A slide held on screen, with an optional slow push. */
const renderClip = (slide, index) => {
  const frames = Math.max(2, Math.round(slide.dur * FPS))
  const chain = ['setsar=1']
  if (slide.zoom) {
    const [z0, z1] = slide.zoom
    chain.push(
      `zoompan=z='${z0}+(${z1}-${z0})*on/${
        frames - 1
      }':d=1:x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':s=${CANVAS_W}x${CANVAS_H}:fps=${FPS}`,
    )
  }
  chain.push('format=yuv420p')

  const out = resolve(
    buildDir,
    `clip-${String(index + 1).padStart(2, '0')}.mp4`,
  )
  ffmpeg([
    '-loop',
    '1',
    '-framerate',
    String(FPS),
    '-t',
    String(slide.dur),
    '-i',
    slide.image,
    '-vf',
    chain.join(','),
    '-frames:v',
    String(frames),
    '-c:v',
    'libx264',
    '-crf',
    '18',
    '-preset',
    'veryfast',
    '-pix_fmt',
    'yuv420p',
    out,
  ])

  return {
    path: out,
    dur: frames / FPS,
    cutIn: Boolean(slide.cutIn),
    fade: slide.fade,
  }
}

/** Joins the clips, keeping the running length exact. */
const chainClips = (clips) => {
  let current = clips[0].path
  let length = clips[0].dur

  for (let index = 1; index < clips.length; index += 1) {
    const next = clips[index]
    const fade = next.cutIn ? CUT : next.fade ?? 0.25
    const out = resolve(buildDir, `chain-${String(index).padStart(2, '0')}.mp4`)
    ffmpeg([
      '-i',
      current,
      '-i',
      next.path,
      '-filter_complex',
      `[0:v][1:v]xfade=transition=fade:duration=${fade.toFixed(3)}:offset=${(
        length - fade
      ).toFixed(3)},format=yuv420p[v]`,
      '-map',
      '[v]',
      '-c:v',
      'libx264',
      '-crf',
      '18',
      '-preset',
      'veryfast',
      '-pix_fmt',
      'yuv420p',
      out,
    ])
    current = out
    length = length + next.dur - fade
  }

  return { path: current, dur: length }
}

/** Voice-over on silence, levelled to the trailer's speech loudness. */
const renderVoice = (dur) => {
  const out = resolve(buildDir, 'voice.wav')
  const inputs = []
  const parts = []
  const labels = ['0:a']

  VOICE.forEach((clip, index) => {
    const source = resolve(voiceDir, clip.file)
    if (!existsSync(source)) {
      throw new Error(`Missing voice clip: ${source}`)
    }

    inputs.push('-i', source)
    const delay = Math.round(clip.at * 1000)
    parts.push(
      `[${
        index + 1
      }:a]loudnorm=I=-16:TP=-1.5:LRA=11,aformat=sample_rates=48000:channel_layouts=stereo,adelay=${delay}|${delay}[vo${index}]`,
    )
    labels.push(`vo${index}`)
  })

  parts.push(
    `${labels.map((label) => `[${label}]`).join('')}amix=inputs=${
      labels.length
    }:normalize=0:duration=first[out]`,
  )

  ffmpeg([
    '-f',
    'lavfi',
    '-t',
    String(dur),
    '-i',
    'anullsrc=r=48000:cl=stereo',
    ...inputs,
    '-filter_complex',
    parts.join(';'),
    '-map',
    '[out]',
    '-c:a',
    'pcm_s16le',
    out,
  ])

  return out
}

const buildBeat = async () => {
  mkdirSync(buildDir, { recursive: true })
  const slides = await renderSlides()
  const chained = chainClips(slides.map(renderClip))
  const silent = resolve(buildDir, 'beat-silent.mp4')
  ffmpeg(['-i', chained.path, '-c', 'copy', silent])

  const dur = durationOf(silent)
  const voice = renderVoice(dur)
  const out = resolve(buildDir, 'trailer-beat.mp4')
  ffmpeg([
    '-i',
    silent,
    '-i',
    voice,
    '-map',
    '0:v',
    '-map',
    '1:a',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-shortest',
    out,
  ])

  console.log(`beat: ${out} (${dur.toFixed(2)}s)`)
  console.log('Next: node apps/studymesh/scripts/build-trailer-beat.mjs splice')
}

const splice = () => {
  const beat = resolve(buildDir, 'trailer-beat.mp4')
  if (!existsSync(beat)) {
    throw new Error(`No beat at ${beat}. Run the beat stage first.`)
  }

  const beatDur = durationOf(beat)
  const trailerDur = durationOf(trailerPath)
  // Splicing an already-spliced trailer inserts the beat a second time, and the
  // result looks almost right until the payoff plays twice. Cheap guard: the cut
  // this beat belongs to is 57.4s, and anything longer already has it.
  if (trailerDur > SPLICED_MIN_DURATION && !process.env.TRAILER_FORCE_SPLICE) {
    throw new Error(
      `${trailerPath} is ${trailerDur.toFixed(
        2,
      )}s, which already includes the beat. ` +
        'Restore the original with git checkout, or set TRAILER_FORCE_SPLICE=1.',
    )
  }

  const out = resolve(buildDir, 'trailer-spliced.mp4')

  // xfade and acrossfade both refuse mismatched inputs, and the trailer is
  // 44.1 kHz while the beat is 48 kHz, so every branch is normalised first.
  const video = `fps=${FPS},scale=${CANVAS_W}:${CANVAS_H},setsar=1,format=yuv420p,settb=AVTB`
  const audio =
    'aresample=48000,aformat=sample_rates=48000:channel_layouts=stereo,asettb=AVTB'
  // One encode for the whole cut: chaining xfades through intermediate files
  // would re-compress the untouched 57s twice over.
  const filter = [
    `[0:v]trim=0:${SEAM},setpts=PTS-STARTPTS,${video}[hv]`,
    `[0:a]atrim=0:${SEAM},asetpts=PTS-STARTPTS,${audio}[ha]`,
    `[0:v]trim=${SEAM}:${trailerDur},setpts=PTS-STARTPTS,${video}[tv]`,
    `[0:a]atrim=${SEAM}:${trailerDur},asetpts=PTS-STARTPTS,${audio}[ta]`,
    `[1:v]${video}[bv]`,
    `[1:a]${audio}[ba]`,
    `[hv][bv]xfade=transition=fade:duration=${JOIN_FADE}:offset=${(
      SEAM - JOIN_FADE
    ).toFixed(3)}[j1]`,
    `[j1][tv]xfade=transition=fade:duration=${JOIN_FADE}:offset=${(
      SEAM +
      beatDur -
      2 * JOIN_FADE
    ).toFixed(3)}[vout]`,
    `[ha][ba]acrossfade=d=${JOIN_FADE}[a1]`,
    `[a1][ta]acrossfade=d=${JOIN_FADE}[aout]`,
  ].join(';')

  ffmpeg([
    '-i',
    trailerPath,
    '-i',
    beat,
    '-filter_complex',
    filter,
    '-map',
    '[vout]',
    '-map',
    '[aout]',
    '-c:v',
    'libx264',
    '-crf',
    '22',
    '-preset',
    'slow',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(FPS),
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    out,
  ])

  console.log(`spliced: ${out} (${durationOf(out).toFixed(2)}s)`)
  console.log('Watch it, then: build-trailer-beat.mjs install')
}

/** Puts the spliced cut where webpack expects it, once it has been watched. */
const install = () => {
  const spliced = resolve(buildDir, 'trailer-spliced.mp4')
  if (!existsSync(spliced)) {
    throw new Error(`No spliced cut at ${spliced}. Run the splice stage first.`)
  }

  const dur = durationOf(spliced)
  if (dur < SPLICED_MIN_DURATION) {
    throw new Error(`${spliced} is ${dur.toFixed(2)}s, so the beat is missing.`)
  }

  copyFileSync(spliced, trailerPath)
  const size = statSync(trailerPath).size / (1024 * 1024)
  console.log(
    `installed: ${trailerPath} (${dur.toFixed(2)}s, ${size.toFixed(1)} MB)`,
  )
}

const [command] = process.argv.slice(2)

if (command === 'beat') {
  await buildBeat()
} else if (command === 'splice') {
  splice()
} else if (command === 'install') {
  install()
} else {
  console.log('Usage: build-trailer-beat.mjs beat | splice | install')
  process.exit(1)
}
