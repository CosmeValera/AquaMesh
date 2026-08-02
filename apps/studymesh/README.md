# RabbitHole app

RabbitHole is the main app in this monorepo. It turns a one-line prompt into a multi-page **Quick Guide** that explains a new idea through what the reader already understands, then keeps the guide usable: quizzes, flashcards, podcast recaps, AI Chat, and a dashboard workspace to arrange it all.

## Product workflow

1. Write a prompt in the Creation panel saying what you are curious about.
2. RabbitHole generates a Quick Guide: several pages of lessons plus study widgets and exercises.
3. Use Quick Create for one-click material from the dashboard you already have open (quiz, flashcards, podcast).
4. Ask AI Chat about the guide; it can fetch web sources when the material does not cover something, and add a page from a source.
5. Arrange guides and widgets on the dashboard canvas and reopen them later from the workspace.

Guides start short (~3 pages) and grow on demand, so a topic can stay a five-minute read or turn into a long session.

## User-facing capabilities

- **Prompt to Quick Guide:** a learning goal in, a full tutorial-style multi-dashboard guide out.
- **Adapts to what you know:** declare the fields you already understand and new guides are re-explained through them. Finishing a guide offers to add that topic to the list, so the lens keeps growing.
- **Quick Create:** one click turns the active dashboard into a quiz, flashcards, or a two-voice podcast recap.
- **AI Chat:** questions about a guide, with optional web-grounded sources.
- **Workspace:** drag, resize, and tab guides and widgets on a dashboard canvas.
- **Choice of AI:** Hosted AI paid with Carrots, your own Gemini or Cerebras API key, or Google on-device Local AI.
- **Prepared demo at `/try`:** five sample guides a logged-out visitor can walk through — real pages, quizzes, flashcards, podcast and chat — with no account, no sign-up and no API call.

## The `/try` demo

`/try` lets a visitor pick one of five prepared topics and open it in the real workspace. It renders the actual components (`StudyPathWorkspaceView`, `StudyGuidePagesPanel`, `DashboardChatPanel`, `StudyBlockView`) against frozen data, so it is the app rather than a mockup — but nothing about it is live. The generation wait, the Quick Create runs and the chat answers are all canned, and a demo session must never reach a serverless route. `tests/e2e/demo.spec.ts` asserts that contract by collecting every request of a full run.

Where the pieces live:

- `src/demo/` — the data contract (`types.ts`), the guide registry (`demoGuides.ts`), session state (`demoSession.ts`) and the page-append logic (`demoStudyPath.ts`).
- `src/demo/guides/<name>.ts` + `<name>.data.json` — one machine-generated capture per guide, plus a hand-written wrapper that colocates its three chat exchanges. One webpack chunk each, loaded only when that guide is opened.
- `src/components/demo/` — the `/try` topic picker, the guide page, the guest top bar, the conversion banner and the signup nudge.
- `public/demo/audio/<slug>.mp3` — the podcast audio, served as static files.

Content is captured with `scripts/build-demo-guide.mjs`, which runs a real generation plus the quiz, flashcard and podcast Quick Creates, then normalises and leak-scans the result. **Guide prose is never hand-edited** — a weak guide is regenerated, because the whole point is that this is genuinely what the app produces. See [`docs/demo-guide-capture.md`](./docs/demo-guide-capture.md).

## Available scripts

From the repository root, run:

```sh
npm start
npm test
npm --workspace studymesh run test:unit
npm --workspace studymesh run test:e2e
npm --workspace studymesh run test:snapshot
```

From `apps/studymesh`, the local app scripts are:

### `npm start`

Runs the app in development mode.
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

### `npm test`

Runs both unit and end-to-end tests for the RabbitHole app.

More specific test commands:

- `npm run test:unit` runs unit tests.
- `npm run test:snapshot` updates Playwright snapshots.
- `npm run test:e2e` runs end-to-end tests.

## Technical stack

- React 18
- TypeScript
- Webpack
- Material UI and PrimeReact
- SCSS modules
- flexlayout-react and react-tabs
- Vitest and Playwright

## Architecture

RabbitHole is the application for guide generation and the dashboard workspace. Guides, widgets, and dashboards are stored locally, with optional cloud sync for signed-in accounts. The workspace supports reusable widgets, dashboard templates, import/export, and version history.

The workspace directory, the npm workspace name, and the module-federation name all stay lowercase `studymesh`. Those are internal identifiers and are deliberately not part of the rebrand — renaming them would orphan existing users' stored guides, widgets, and settings.
