# Capturing the `/try` demo guides

The five sample guides behind `/try` are real generations, frozen. They are
produced by `apps/studymesh/scripts/build-demo-guide.mjs` and committed as data;
nothing about them is generated at runtime, and the demo makes no API call.

> **Never hand-edit the guide prose.** If a guide reads badly, regenerate it. The
> entire value of the demo is that a visitor is looking at what RabbitHole
> actually produces. A hand-polished sample is marketing copy that the product
> cannot deliver, and it is worse than a weak guide.
>
> The hand-written parts are the guide wrapper (`src/demo/guides/<name>.ts`) and
> its three chat exchanges. The `.data.json` next to it is machine output.

## What the script does

Per slug, `build-demo-guide.mjs` follows the harness pattern of
`scripts/hybrid-study-guide-eval.ts` — it drives the real generation with an
injected transport rather than reimplementing prompts:

1. Runs `generateStudyPathWithAi` on the guide's prompt from
   `src/demo/demoGuides.ts`.
2. Runs the quiz, flashcards and podcast Quick Creates against the result.
3. Normalises and leak-scans the capture, then writes
   `src/demo/guides/<name>.data.json`.

Raw, un-normalised captures go to a git-ignored `scripts/.capture/`.

### Environment

- The text-provider key the eval harness already uses, in `.env` / `.env.local`.
- `UNREAL_SPEECH_API_KEY` for the podcast audio.

If TTS is unreachable, the podcast pages can ship transcript-only and the MP3s
can be dropped in later; nothing else in the pipeline depends on them.

## Normalisation

Determinism is a hard requirement: the tests, the deep links and the session
rehydration all key off stable ids, and a `Date.now()` or `nanoid` left in the
data would break all three.

- `pathId` becomes `demo-<slug>`, and every `dashboardKey` becomes
  `${pathId}-page-${n}`. One recursive string rewrite then fixes `studyPathId`,
  `studyPathDashboardKey`, every derived component id, and every
  `studymesh-page:` cross-link inside the markdown.
- Podcast `audioPath` becomes `/demo/audio/<slug>.mp3`; its ids and `createdAt`
  are frozen.
- All timestamps become a single fixed ISO date. `visitedPageKeys`, `pinnedAt`
  and `pinnedDashboardKeys` are dropped; `selectedIndex` is forced to `0` and
  `contentLanguage` to `'en'`.
- Pages 1-3 go to `studyPath.dashboards`. The three Quick Create pages go to
  `bonusPages`, and each one's `actionId` is derived by **scanning its blocks**
  for `QuizCarouselBlock` / `FlashcardCarouselBlock` / `PodcastBlock` — never by
  position. Zero or more than one match is a hard failure.
- The held-back pages are stored as complete `StudyPathDashboardItem`s, not as
  generation drafts. Rebuilding them at runtime would mint a fresh
  `Date.now()`+`nanoid` key and destroy determinism.

## Leak scan (hard failure)

The raw capture embeds a real `userId` in `audioPath`, so this net is not
theoretical. The script fails on any of:

- a UUID, an email address, `supabase.co`, `Bearer `, `eyJ`, `sb-`,
  `access_token`
- a surviving pre-normalisation `pathId`

A unit test repeats the same scan over all five serialised guides, so a careless
re-capture cannot land silently.

## Shape assertions

- Exactly 3 lesson pages + 3 bonus pages, with distinct `actionId`s.
- Every block type is in `STUDY_BLOCK_TYPES`
  (`src/components/study/StudyBlockView.tsx`). This assertion fails the moment a
  block type is renamed, which is the main guard against the frozen data
  drifting away from the components that render it.
- Every page carries `studyPathId` and `studyPathDashboardKey`, which is what
  `src/components/Dasboard/studyPathContainer.ts` needs to render it.
- Quick Start is non-empty.
- Every `audioPath` is under `/demo/audio/`.

## Audio

Encode with `ffmpeg -ac 1 -b:a 48k -ar 24000`, 2-3 minutes, roughly 1.2 MB each,
into `apps/studymesh/public/demo/audio/`. Dev needs no extra config
(webpack-dev-server already serves `public/`); the production build copies the
directory through a `CopyWebpackPlugin` pattern in `webpack.config.prod.js`.

`PodcastPlayerProvider.isStaticPodcastAudioPath` is a literal `/demo/audio/`
prefix match, so these files play without a signed URL while every real,
account-owned podcast path still goes through the gateway.

## After a re-capture

1. Bump `DEMO_DATA_VERSION` in `src/demo/types.ts` — stored demo sessions with a
   different version are discarded instead of replayed against new content.
2. Run `npm --workspace studymesh run test:unit` (leak scan + content
   invariants), then `npm --workspace studymesh run test:e2e` for
   `tests/e2e/demo.spec.ts`.
3. Read the guide end to end. This is public-facing copy now: a hallucinated
   claim here is worse than one in a user's private guide.
