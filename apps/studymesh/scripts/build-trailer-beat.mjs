/**
 * Builds the "one guide opens three more" trailer beat, splices it into the
 * landing trailer, and punches in on the trailer's opening shot.
 *
 * The beat is one designed scene, not a screen recording. Raw screenshots pasted
 * edge to edge looked nothing like the rest of the cut, which frames the app in
 * a rounded white card on a periwinkle ground with a tilted chip label. So every
 * frame here is HTML rendered through Playwright at 1920x1080 around the real
 * screenshots, and the palette is sampled straight out of the trailer frames
 * kept in readme_docs/trailer/reference/style-*.png.
 *
 * Nothing cuts to a replacement frame: every element keeps its identity and
 * moves, which is why the layout is keyframes measured off the real DOM and the
 * movement stages render one PNG per frame.
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
// Two frames, which reads as a cut. Not one: xfade with a single-frame duration
// silently drops the second input and the chain stops growing.
const CUT = 2 / FPS
// The audio drops to -36 dBFS here, its quietest point outside head and tail,
// so cutting in the trough hides the seam.
const SEAM = 45.0
// The tail picks up at the bunny outro rather than back at the seam: 45.0-45.5
// is the previous slide holding, and resuming there flashed a second of it after
// the beat had already replaced that thought. 45.83 specifically: the base cut
// has true digital silence from 45.55 to 45.82 and the outro's first voice line
// starts right after it, so the join lands in the gap without clipping a word.
const TAIL_START = 45.83
const JOIN_FADE = 0.3
// The punch-in on the opening modal. The logo card that opens the trailer is
// left at 1:1 — the push starts under the dissolve that replaces it, so the
// modal is already at full size by the time it is solid, and eases back before
// the recording starts moving it up the screen.
const OPENING_ZOOM = 1.5
const OPENING_IN_START = 1.2
const OPENING_IN_END = 1.8
const OPENING_HOLD_END = 2.7
const OPENING_SETTLE = 3.4
const OPENING_END = 3.5
// The trailer without this beat is 57.4s; anything past this already carries it.
const SPLICED_MIN_DURATION = 60

// Sampled from the trailer's own frames: the periwinkle ground and chip of the
// "Chat with AI" card frame, and the accent bars of the gradient slide's rows.
const PALETTE = {
  ground: '#C1D7FF',
  chip: '#90AEE2',
  ink: '#1A1F30',
  accents: ['#1A56DB', '#0F766E', '#A21567'],
}

/** Reference stills that need trimming before they can sit in a card. */
const CROPS = {
  donut: { file: '21-quiz-results-card.png', crop: [0, 8, 1017, 340] },
}

// One label for the whole beat, because it is now one continuous scene rather
// than a run of separate frames.
const CHIP = 'RabbitHoles'
// The result ring says nothing about what was learned, and the three follow-ups
// under it all bridge from this skill, so the card names it.
const QUIZ = {
  eyebrow: 'Quiz complete',
  title: 'Caffeine and adenosine signaling',
}
const LINK_INK = '#5A6B99'
const ORIGIN = { left: 0, top: 0, scale: 1 }

// The result opens the beat on its own, so it is held well above its natural
// size: at 1:1 it read as a stamp floating in the middle of the frame.
const RESULT_SCALE = 1.5
// Side by side while the result hands over to the follow-ups it opened. Sized to
// fill the width between thin margins rather than to a round number.
const PAIR_SCALE = 0.75
const PAIR_MARGIN = 68
const PAIR_GAP = 80
// Where the column ends up once it has made room for the opened guides.
const COLUMN_LEFT_X = 65
const SHIFT_SCALE = 0.72
// Fraction of the opening move spent travelling; the rest is the card settling.
const MOVE_TRAVEL = 0.7

const DETAIL = { left: 1020, width: 810, gap: 40 }

/**
 * The picks, and the guide each one became. The key lines are the real Quick
 * Start openers, clipped to a line.
 */
const FLOW = {
  panel: '04-ideas-three-selected-panel.png',
  via: 'via Caffeine and adenosine signaling',
  guides: [
    {
      title: 'Caffeine and dreams',
      key: 'Bedtime caffeine can hide sleep pressure while clearance and rebound reshape the night.',
    },
    {
      title: 'Plan caffeine timing',
      key: 'Treat caffeine as a temporary receptor blockade, then schedule clearance before sleep.',
    },
    {
      title: 'Receptor blockers',
      key: 'A blocker occupies the receptor, so the messenger has fewer usable sites.',
    },
  ],
}

/**
 * Two of those guides opened, set as type rather than pasted as screenshots so
 * they stay readable at this size. Both carry the same bridge in their tab,
 * which is the whole point of the beat.
 */
const DETAILS = [
  {
    title: 'Quick Start',
    subtitle: 'Key idea before reading',
    tab: 'Via Caffeine and adenosine signaling',
    keyIdea:
      'Think of bedtime caffeine as a lingering dose whose receptor blockade can hide sleep pressure while clearance and rebound reshape the night’s stages.',
    summary: [
      'A larger or later dose leaves more active signal at bedtime. Blockade can mask sleep pressure enough for normal sleep onset, but not for normal deep sleep.',
      'As caffeine clears, its influence changes across the night: REM shifts toward morning, and brief awakenings make dreams easier to remember.',
    ],
  },
  {
    title: 'Quick Start',
    subtitle: 'Key idea before reading',
    tab: 'Via Caffeine and adenosine signaling',
    keyIdea:
      'Treat caffeine molecules as a temporary receptor blockade layered over rising adenosine buildup, then schedule clearance before your sleep window.',
    summary: [
      'A larger dose puts more molecules into circulation, so more blockade can support alertness, but more of it remains to clear.',
      'Take the smallest useful dose early enough for clearance to lower receptor occupancy before bed, and let adenosine be felt again.',
    ],
  },
]

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

/**
 * One scene, animated end to end: the quiz result, the follow-ups it opened,
 * the guides they became, and two of those guides opened. Nothing here cuts to
 * a new frame — every element keeps its identity and moves, which is why the
 * layout is a set of keyframes measured off the real DOM rather than a stack of
 * separate slides.
 */
const scene = (state, cropped, K) => {
  const quiz = lerpBox(K.quizHome, K.quizAside, state.split)
  const promoted = lerpBox(K.columnAside, K.columnTop, state.promote)
  const column = lerpBox(promoted, K.columnLeft, state.shift)
  const quizOpacity =
    (state.split > 0 || state.promote > 0 ? 1 : 1) * (1 - state.promote)
  const columnOpacity = state.split
  // Gone early in the promote: the column travels back past the quiz, and an
  // arrow whose head ends up behind its own tail reads as a glitch.
  const linkOpacity = state.split * (1 - Math.min(1, state.promote * 4))

  const arrows = PALETTE.accents
    .map(
      (accent, index) => `
      <div class="arrow" style="opacity: ${index < state.arrived ? 1 : 0}">
        <svg viewBox="0 0 24 62" width="30" height="72" aria-hidden="true">
          <path d="M12 2 L12 42" stroke="${accent}" stroke-width="5" stroke-linecap="round" fill="none"/>
          <path d="M4 36 L12 54 L20 36" stroke="${accent}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
      </div>`,
    )
    .join('')

  // Row 0 dims for nothing, row 1 dims until its own guide opens, row 2 stays
  // dim once anything is lit: the eye should only ever have one new thing.
  const litFor = [state.litA, state.litB, 0]
  const dimFor = [
    0,
    Math.max(0, state.litA - state.litB),
    Math.max(state.litA, state.litB),
  ]
  const guides = FLOW.guides
    .map(
      (guide, index) => `
      <div class="guide" style="--accent: ${PALETTE.accents[index]}; --lit: ${
        litFor[index]
      }; opacity: ${
        index < state.arrived ? (1 - dimFor[index] * 0.55).toFixed(3) : 0
      }">
        <div class="bar"></div>
        <div>
          <div class="title">${guide.title}</div>
          <div class="via">${FLOW.via}</div>
          <div class="key">${guide.key}</div>
        </div>
      </div>`,
    )
    .join('')

  const details = DETAILS.map(
    (card, index) => `
      <div class="detail" style="--accent: ${PALETTE.accents[index]}; top: ${
        K.detailTops[index]
      }px; opacity: ${index === 0 ? state.detailA : state.detailB}">
        <h2>${card.title}</h2>
        <div class="sub">${card.subtitle}</div>
        <div class="tab">${card.tab}</div>
        <div class="rule"></div>
        <div class="label">KEY IDEA</div>
        <div class="lead-text">${card.keyIdea}</div>
        <div class="label">QUICK SUMMARY</div>
        ${card.summary
          .map((para) => `<p class="body-text">${para}</p>`)
          .join('')}
      </div>`,
  ).join('')

  // Drawn against the live boxes, so a keyframe can be retuned without hunting
  // for the coordinates the arrows were hard-coded to.
  const links = []
  const from = quiz.left + K.quiz.width * quiz.scale + 16
  const to = column.left - 16
  if (linkOpacity > 0.01 && to - from > 30) {
    links.push(
      `<path d="M${from.toFixed(1)} 540 L${to.toFixed(
        1,
      )} 540" stroke="${LINK_INK}" stroke-width="5" fill="none" stroke-linecap="round" opacity="${linkOpacity.toFixed(
        3,
      )}"/>`,
      `<path d="M${(to - 15).toFixed(1)} 530 L${to.toFixed(1)} 540 L${(
        to - 15
      ).toFixed(
        1,
      )} 550" stroke="${LINK_INK}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${linkOpacity.toFixed(
        3,
      )}"/>`,
    )
  }
  ;[state.detailA, state.detailB].forEach((opacity, index) => {
    if (opacity <= 0.01) {
      return
    }

    const x = column.left + K.column.width * column.scale + 10
    const y = column.top + K.rowCenters[index] * column.scale
    const endX = DETAIL.left - 14
    const endY = K.detailTops[index] + K.detailHeights[index] / 2
    const accent = PALETTE.accents[index]
    links.push(
      `<path d="${elbow(
        x,
        y,
        endX,
        endY,
      )}" stroke="${accent}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity.toFixed(
        3,
      )}"/>`,
      `<path d="M${endX - 15} ${endY - 10} L${endX} ${endY} L${endX - 15} ${
        endY + 10
      }" stroke="${accent}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity.toFixed(
        3,
      )}"/>`,
    )
  })

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  ${baseCss}
  .stage { background: ${PALETTE.ground}; position: relative; }
  .chip {
    position: absolute;
    top: 46px;
    left: 74px;
    transform: rotate(-1.4deg);
    background: ${PALETTE.chip};
    color: #fff;
    font-size: 42px;
    font-weight: 600;
    padding: 16px 38px 18px;
    border-radius: 20px;
    box-shadow: 0 12px 30px rgba(28, 40, 90, 0.2);
  }
  .quiz, .column {
    position: absolute;
    transform-origin: top left;
  }
  .quiz {
    left: ${quiz.left.toFixed(2)}px;
    top: ${quiz.top.toFixed(2)}px;
    transform: scale(${quiz.scale.toFixed(4)});
    opacity: ${quizOpacity.toFixed(3)};
  }
  .column {
    width: 1180px;
    left: ${column.left.toFixed(2)}px;
    top: ${column.top.toFixed(2)}px;
    transform: scale(${column.scale.toFixed(4)});
    opacity: ${columnOpacity.toFixed(3)};
  }
  .card {
    background: #fff;
    border-radius: 22px;
    padding: 26px;
    box-shadow: 0 22px 52px rgba(28, 40, 90, 0.18);
  }
  .quiz .card img { display: block; width: 1040px; height: auto; border-radius: 8px; }
  .quiz .eyebrow {
    font-size: 17px;
    font-weight: 600;
    letter-spacing: 1.4px;
    text-transform: uppercase;
    color: #6B7690;
    margin: 2px 0 0 6px;
  }
  .quiz-title {
    font-size: 34px;
    font-weight: 700;
    margin: 4px 0 20px 6px;
  }
  .column .card img { display: block; width: 1128px; height: auto; border-radius: 8px; }
  .arrows {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    padding: 2px 70px 0;
  }
  .arrow { display: flex; justify-content: center; }
  .guides { display: flex; flex-direction: column; gap: 14px; }
  .guide {
    display: flex;
    gap: 22px;
    background: #fff;
    border-radius: 16px;
    padding: 16px 26px;
    box-shadow: 0 14px 30px rgba(28, 40, 90, 0.12);
    outline: calc(var(--lit) * 4px) solid var(--accent);
    outline-offset: 2px;
  }
  .bar { width: 6px; border-radius: 3px; background: var(--accent); }
  .title { font-size: 30px; font-weight: 600; line-height: 1.2; }
  .via { font-size: 23px; font-weight: 600; color: var(--accent); margin-top: 2px; }
  .key {
    font-size: 22px;
    color: #55607A;
    margin-top: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .links { position: absolute; inset: 0; }
  .detail {
    position: absolute;
    left: ${DETAIL.left}px;
    width: ${DETAIL.width}px;
    background: #fff;
    border-radius: 20px;
    padding: 24px 30px 28px;
    box-shadow: 0 22px 52px rgba(28, 40, 90, 0.18);
  }
  .detail h2 { font-size: 28px; font-weight: 700; }
  .detail .sub { font-size: 16px; color: #6B7690; margin-top: 2px; }
  .detail .tab {
    display: inline-block;
    font-size: 20px;
    font-weight: 600;
    color: var(--accent);
    border-bottom: 3px solid var(--accent);
    padding-bottom: 6px;
    margin: 14px 0 4px;
  }
  .detail .rule { border-top: 1px solid #E4E8F0; }
  .detail .label {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.8px;
    color: var(--accent);
    margin-top: 14px;
  }
  .detail .lead-text { font-size: 20px; line-height: 1.42; margin-top: 5px; }
  .detail .body-text {
    font-size: 17px;
    line-height: 1.45;
    color: #55607A;
    margin-top: 5px;
  }
</style></head>
<body><div class="stage">
  <div class="chip">${CHIP}</div>
  <div class="quiz"><div class="card">
    <div class="eyebrow">${QUIZ.eyebrow}</div>
    <div class="quiz-title">${QUIZ.title}</div>
    <img src="${imageUrl('donut', cropped)}">
  </div></div>
  <div class="column">
    <div class="card"><img src="${imageUrl(FLOW.panel, cropped)}"></div>
    <div class="arrows">${arrows}</div>
    <div class="guides">${guides}</div>
  </div>
  <svg class="links" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">${links.join(
    '',
  )}</svg>
  ${details}
</div></body></html>`
}

/**
 * Right-angle connector with rounded corners, matching the straight arrows the
 * scene already uses. A single bezier over this little horizontal run hooked
 * back under its own arrowhead.
 */
const elbow = (x1, y1, x2, y2) => {
  const mx = (x1 + x2) / 2
  const dy = y2 - y1
  if (Math.abs(dy) < 3) {
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(
      1,
    )}`
  }

  const step = Math.sign(dy)
  const r = Math.min(22, Math.abs(dy) / 2, Math.abs(mx - x1), Math.abs(x2 - mx))
  const p = (value) => value.toFixed(1)

  return [
    `M${p(x1)} ${p(y1)}`,
    `L${p(mx - r)} ${p(y1)}`,
    `Q${p(mx)} ${p(y1)} ${p(mx)} ${p(y1 + step * r)}`,
    `L${p(mx)} ${p(y2 - step * r)}`,
    `Q${p(mx)} ${p(y2)} ${p(mx + r)} ${p(y2)}`,
    `L${p(x2)} ${p(y2)}`,
  ].join(' ')
}

const lerp = (a, b, t) => a + (b - a) * t

const lerpBox = (a, b, t) => ({
  left: lerp(a.left, b.left, t),
  top: lerp(a.top, b.top, t),
  scale: lerp(a.scale, b.scale, t),
})

/** Smooth start and stop, so nothing jerks into place. */
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

const REST = {
  split: 0,
  promote: 0,
  shift: 0,
  arrived: 0,
  litA: 0,
  litB: 0,
  detailA: 0,
  detailB: 0,
}

/**
 * The scene's beats. `hold` is a still; `move` renders one PNG per frame,
 * because a dissolve between two positions looks like a dissolve and these
 * elements are supposed to travel.
 */
const STAGES = [
  { name: 'result', dur: 1.6, state: () => ({}) },
  {
    name: 'open',
    frames: 20,
    state: (t) => ({ split: ease(t) }),
  },
  { name: 'pair', dur: 1.0, state: () => ({ split: 1 }) },
  {
    name: 'promote',
    frames: 22,
    state: (t) => ({ split: 1, promote: ease(t) }),
  },
  {
    name: 'guide-1',
    dur: 0.55,
    fade: 0.22,
    state: () => ({ split: 1, promote: 1, arrived: 1 }),
  },
  {
    name: 'guide-2',
    dur: 0.55,
    fade: 0.22,
    state: () => ({ split: 1, promote: 1, arrived: 2 }),
  },
  {
    name: 'guide-3',
    dur: 1.1,
    fade: 0.22,
    state: () => ({ split: 1, promote: 1, arrived: 3 }),
  },
  {
    name: 'open-a',
    frames: 24,
    state: (t) => {
      // The travel finishes early and the card fades in after it, so the card
      // lands in the space that was made rather than over the column.
      const travel = ease(Math.min(1, t / MOVE_TRAVEL))
      return {
        split: 1,
        promote: 1,
        arrived: 3,
        shift: travel,
        litA: travel,
        detailA: ease(
          Math.max(0, (t - MOVE_TRAVEL + 0.08) / (1.08 - MOVE_TRAVEL)),
        ),
      }
    },
  },
  {
    name: 'read-a',
    dur: 1.5,
    state: () => ({
      split: 1,
      promote: 1,
      arrived: 3,
      shift: 1,
      litA: 1,
      detailA: 1,
    }),
  },
  {
    name: 'open-b',
    frames: 16,
    state: (t) => ({
      split: 1,
      promote: 1,
      arrived: 3,
      shift: 1,
      litA: 1,
      detailA: 1,
      litB: ease(t),
      detailB: ease(Math.max(0, (t - 0.3) / 0.7)),
    }),
  },
  {
    // Long on purpose: the voice ends well before this does, and the closing
    // frame is the one worth reading.
    name: 'read-b',
    dur: 3.5,
    state: () => ({
      split: 1,
      promote: 1,
      arrived: 3,
      shift: 1,
      litA: 1,
      detailA: 1,
      litB: 1,
      detailB: 1,
    }),
  },
]

/**
 * Keyframes derived from the real boxes rather than guessed: the quiz card and
 * the column are measured once, then placed so each stage is balanced whatever
 * the screenshots happen to measure.
 */
const keyframes = (measured) => {
  const { quiz, column, picksHeight, rowCenters, detailHeights } = measured
  const asideScale = PAIR_SCALE
  const topScale = Math.min(1, 1010 / column.height)
  const detailTotal = detailHeights[0] + DETAIL.gap + detailHeights[1]
  const detailTop = (CANVAS_H - detailTotal) / 2

  return {
    quiz,
    column,
    rowCenters,
    detailHeights,
    detailTops: [detailTop, detailTop + detailHeights[0] + DETAIL.gap],
    quizHome: {
      left: (CANVAS_W - quiz.width * RESULT_SCALE) / 2,
      top: (CANVAS_H - quiz.height * RESULT_SCALE) / 2,
      scale: RESULT_SCALE,
    },
    quizAside: {
      left: PAIR_MARGIN,
      top: CANVAS_H / 2 - (quiz.height * asideScale) / 2,
      scale: asideScale,
    },
    columnAside: {
      left: PAIR_MARGIN + quiz.width * asideScale + PAIR_GAP,
      top: CANVAS_H / 2 - (picksHeight * asideScale) / 2,
      scale: asideScale,
    },
    columnTop: {
      left: (CANVAS_W - column.width * topScale) / 2,
      top: (CANVAS_H - column.height * topScale) / 2,
      scale: topScale,
    },
    columnLeft: {
      left: COLUMN_LEFT_X,
      top: (CANVAS_H - column.height * SHIFT_SCALE) / 2,
      scale: SHIFT_SCALE,
    },
  }
}

/** Renders every frame of the scene through headless Chromium. */
const renderSlides = async () => {
  const { chromium } = await import('playwright')
  const cropped = renderCrops()
  const browser = await chromium.launch()
  const page = await browser.newPage({
    viewport: { width: CANVAS_W, height: CANVAS_H },
    deviceScaleFactor: 1,
  })

  const shoot = async (html, out) => {
    await page.setContent(html, { waitUntil: 'networkidle' })
    // Web fonts settle a frame late; without this the first frame renders in
    // the fallback face and the type jumps mid-beat.
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: out })
  }

  // Measuring pass: everything on screen, untransformed, so the boxes are real.
  const probeState = {
    ...REST,
    split: 1,
    promote: 1,
    arrived: 3,
    detailA: 1,
    detailB: 1,
  }
  const probeKeys = {
    quiz: { width: 0, height: 0 },
    column: { width: 0, height: 0 },
    rowCenters: [0, 0, 0],
    detailHeights: [0, 0],
    detailTops: [0, 0],
    quizHome: ORIGIN,
    quizAside: ORIGIN,
    columnAside: ORIGIN,
    columnTop: ORIGIN,
    columnLeft: ORIGIN,
  }
  await page.setContent(scene(probeState, cropped, probeKeys), {
    waitUntil: 'networkidle',
  })
  await page.evaluate(() => document.fonts.ready)
  const measured = await page.evaluate(() => {
    const box = (el) => el.getBoundingClientRect()
    const quiz = box(document.querySelector('.quiz'))
    const column = box(document.querySelector('.column'))
    const picks = box(document.querySelector('.column .card'))
    const rows = [...document.querySelectorAll('.guide')]
    const details = [...document.querySelectorAll('.detail')]
    return {
      quiz: { width: quiz.width, height: quiz.height },
      column: { width: column.width, height: column.height },
      picksHeight: picks.height,
      rowCenters: rows.map((row) => {
        const r = box(row)
        return r.top + r.height / 2 - column.top
      }),
      detailHeights: details.map((card) => box(card).height),
    }
  })
  const keys = keyframes(measured)

  const rendered = []
  for (const stage of STAGES) {
    if (stage.frames) {
      const images = []
      for (let frame = 0; frame < stage.frames; frame += 1) {
        const t = frame / (stage.frames - 1)
        const out = resolve(
          buildDir,
          `seq-${stage.name}-${String(frame).padStart(3, '0')}.png`,
        )
        await shoot(scene({ ...REST, ...stage.state(t) }, cropped, keys), out)
        images.push(out)
      }
      rendered.push({ ...stage, images, dur: stage.frames / FPS })
      continue
    }

    const out = resolve(buildDir, `still-${stage.name}.png`)
    await shoot(scene({ ...REST, ...stage.state(1) }, cropped, keys), out)
    rendered.push({ ...stage, image: out })
  }

  await browser.close()
  return rendered
}

/** A still held on screen, or a rendered sequence played straight through. */
const renderClip = (stage, index) => {
  const out = resolve(
    buildDir,
    `clip-${String(index + 1).padStart(2, '0')}.mp4`,
  )

  if (stage.images) {
    ffmpeg([
      '-framerate',
      String(FPS),
      '-i',
      resolve(buildDir, `seq-${stage.name}-%03d.png`),
      '-vf',
      'setsar=1,format=yuv420p',
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
      dur: stage.images.length / FPS,
      cutIn: true,
      fade: stage.fade,
    }
  }

  const frames = Math.max(2, Math.round(stage.dur * FPS))
  ffmpeg([
    '-loop',
    '1',
    '-framerate',
    String(FPS),
    '-t',
    String(stage.dur),
    '-i',
    stage.image,
    '-vf',
    'setsar=1,format=yuv420p',
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
    cutIn: !stage.fade,
    fade: stage.fade,
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

  // The cut this beat goes into, which is not necessarily the file on disk: once
  // a spliced trailer is committed, the working copy already carries a beat and
  // splicing it again would stack a second one.
  const basePath = process.env.TRAILER_BASE || trailerPath
  const beatDur = durationOf(beat)
  const trailerDur = durationOf(basePath)
  // Splicing an already-spliced trailer inserts the beat a second time, and the
  // result looks almost right until the payoff plays twice. Cheap guard: the cut
  // this beat belongs to is 57.4s, and anything longer already has it.
  if (trailerDur > SPLICED_MIN_DURATION && !process.env.TRAILER_FORCE_SPLICE) {
    throw new Error(
      `${basePath} is ${trailerDur.toFixed(
        2,
      )}s, which already includes the beat. ` +
        'Point TRAILER_BASE at the pre-beat cut (git show <commit>:apps/studymesh/' +
        'public/videos/trailer.mp4 > base.mp4), or set TRAILER_FORCE_SPLICE=1.',
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
  // The opening holds on the New Quick Guide modal, which sits dead centre at
  // about a third of the frame width and read as a stamp. Punching in and
  // easing back out gives it presence without touching the recording: the logo
  // card is left at 1:1, the push happens under the dissolve that replaces it,
  // and by the time the modal starts travelling up the zoom is back at 1:1, so
  // the shot lands exactly where it always did. Only the first seconds go
  // through zoompan — resampling the whole head would soften 40 s of text.
  const frame = (seconds) => Math.round(seconds * FPS)
  const smooth = (from, to) => {
    const u = `((on-${frame(from)})/${frame(to) - frame(from)})`
    return `(${u}*${u}*(3-2*${u}))`
  }
  const rise = OPENING_ZOOM - 1
  const zoom = [
    `if(lt(on,${frame(OPENING_IN_START)}),1,`,
    `if(lt(on,${frame(OPENING_IN_END)}),1+${rise}*${smooth(
      OPENING_IN_START,
      OPENING_IN_END,
    )},`,
    `if(lt(on,${frame(OPENING_HOLD_END)}),${OPENING_ZOOM},`,
    `if(lt(on,${frame(OPENING_SETTLE)}),${OPENING_ZOOM}-${rise}*${smooth(
      OPENING_HOLD_END,
      OPENING_SETTLE,
    )},`,
    '1))))',
  ].join('')
  const punchIn = `fps=${FPS},zoompan=z='${zoom}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${CANVAS_W}x${CANVAS_H}:fps=${FPS}`

  const filter = [
    `[0:v]trim=0:${OPENING_END},setpts=PTS-STARTPTS,${punchIn},${video}[h1]`,
    `[0:v]trim=${OPENING_END}:${SEAM},setpts=PTS-STARTPTS,${video}[h2]`,
    `[h1][h2]concat=n=2:v=1:a=0[hv]`,
    `[0:a]atrim=0:${SEAM},asetpts=PTS-STARTPTS,${audio}[ha]`,
    `[0:v]trim=${TAIL_START}:${trailerDur},setpts=PTS-STARTPTS,${video}[tv]`,
    `[0:a]atrim=${TAIL_START}:${trailerDur},asetpts=PTS-STARTPTS,${audio}[ta]`,
    `[1:v]${video}[bv]`,
    `[1:a]${audio}[ba]`,
    `[hv][bv]xfade=transition=fade:duration=${JOIN_FADE}:offset=${(
      SEAM - JOIN_FADE
    ).toFixed(3)}[j1]`,
    // Hard cut out of the beat, not a dissolve. The tail opens on a voice line,
    // and crossfading it in ramped that line up from silence, which is audible
    // however short the fade is.
    `[j1][tv]concat=n=2:v=1:a=0[vout]`,
    `[ha][ba]acrossfade=d=${JOIN_FADE}[a1]`,
    `[a1][ta]concat=n=2:v=0:a=1[aout]`,
  ].join(';')

  ffmpeg([
    '-i',
    basePath,
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
