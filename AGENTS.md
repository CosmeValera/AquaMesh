# Repository Guidelines

## Command Wrapper

Always prefix shell commands with `rtk`. For PowerShell built-ins or syntax that are not standalone executables, run them through PowerShell under the wrapper, for example `rtk powershell -NoProfile -Command "Get-ChildItem -Force"`.

## Project Structure & Module Organization

StudyMesh is an npm/Turborepo monorepo. Application code lives in `apps/`: `apps/studymesh` is the main dashboard builder, `apps/control-flow` and `apps/system-lens` are federated React apps (not used). Shared packages live in `packages/` (not used). Theme and PrimeReact SCSS sources are under `style/`. Documentation images and tutorials are in `readme_docs/`. Git hook utilities are in `tools/git-hooks/`.

Within each app, source files are in `src/`, public assets are in `public/`, and build output goes to `dist/`. StudyMesh tests are split into `apps/studymesh/tests/unit` and `apps/studymesh/tests/e2e`.

## Product Direction & Core Workflows

StudyMesh is a student knowledge wiki. The main product goal is helping students turn prompts, messy notes, camera pictures, references, and learning materials into useful tutorials, study dashboards, widgets, exercises, and reusable workspace views without forcing them to manually design dashboards or widgets first.

Keep the main StudyMesh experience clear about the current primary workflows:

- Creation panel: Create Study Guide and Create From Notes have been merged into one Creation section in the workspace shell. This is the main creation entry point future work should preserve. In code, the old `study-path` and `from-notes` flows still exist as branches inside this panel, and older Create Study Pack names still appear in some files.
- Fast creations: the Quick Create actions in the Creation panel correspond to the old Create From Notes direction. They default to one-click generation from the currently active dashboard context and produce focused widgets/dashboards such as quizzes, flashcards, or clearer notes. The advanced/options area can override the source with pasted text and attachments, including text, images, PDFs, and PowerPoint files.
- Slow creation: the Study Guide path maps one-to-one to the old Create Study Guide workflow. It intentionally requires the user to write a prompt. Treat it as the app's highest-value feature: a user can write only a learning goal and receive a full tutorial-style, multi-dashboard Study Guide with lessons, study widgets, and exercises for whatever they want to learn.
- Advanced path: manually create a widget or dashboard. This is the least ideal path for beginner students and should gradually become less prominent. In the future, it may be hidden behind a settings option that enables advanced creation actions in the top navigation menu.
- Workspace path: open an existing Study Guide tutorial, Study Pack, or custom dashboard in the main workspace for study, editing, and reuse.

Creation flows should support several generation modes. Use Create From Notes as the forward-looking name for source-driven fast creation, while still recognizing older Create Study Pack references in existing code or UI until the rename is complete.

Responsive workspace model:

- Phone and tablet: the app behaves like three peer sections with equal navigation weight: Creation, Dashboards, and AI Chat. The bottom section switcher in `WorkspaceStudioShell` is the mental model to preserve.
- Desktop: Dashboards are the primary workspace. The dashboard canvas uses `flexlayout-react` so users can position widgets inside dashboards. Creation sits as a left rail/resizable panel and AI Chat sits as a right rail/resizable panel. Users may keep both side panels open, one open, or both collapsed to focus on dashboards.

Generation modes:

- Basic fallback: does not use AI. It parses notes programmatically from keywords and obvious structure. It is instantaneous, but usually produces weak results. This mode only supports Create From Notes/Create Study Pack flows, not Study Guide. For images, it relies on basic OCR such as Tesseract, so it works best on clear screenshots, slides, or obvious printed text and performs poorly on messy handwritten notes.
- Gemini API token: bring-your-own Gemini token/key. This is the preferred high-quality path for users who already have an API key and want richer AI-generated study materials.
- Google local AI: runs free and locally, with no internet connection required. Results are usually worse than Gemini API mode, but better than Basic fallback. It can still help with image discovery and can turn messy handwritten-note images into usable notes better than the basic OCR fallback.
- Hoisted tokens: not implemented yet. The intended product direction is to give new users a small free allowance, such as 5-10 generations using the app owner's Gemini token. After that, users should switch to local AI, provide their own API token, or optionally make a small payment for continued hosted-token usage, for example a low one-time payment with an hourly usage allowance. This needs payment integration such as Stripe and should avoid feeling like a subscription unless the product direction changes.

Generation flows are currently embedded in the Creation panel, though the older components still use `Modal` in their names. Opening an existing Study Guide tutorial, Study Pack, or custom dashboard should take the user into the main workspace rather than sharing the same creation setup flow.

Strong AI provider model:

- Strong AI providers are hosted text models that can run the shared high-quality Study Pack, Study Guide, and dashboard-chat prompts. Gemini and Cerebras are the current examples. Google Local AI is intentionally separate because it is weaker, browser-local, and has its own orchestration/fallback constraints.
- Add new hosted strong providers in one place first: `apps/studymesh/src/studyPack/ai/strongProviders.ts`. Extend `StrongAiProviderId`, add the config entry in `STRONG_AI_PROVIDERS`, implement the provider call adapter if it is not OpenAI/Gemini-compatible, and keep the adapter returning plain text.
- Strong provider settings are provider-keyed in `apps/studymesh/src/studyPack/ai/settings.ts` under `strongProviders`, with legacy `apiToken`/`model` mapped to Gemini for compatibility. Add the provider env var helper there only if the registry does not already cover it.
- Route generation through `apps/studymesh/src/studyPack/ai/provider.ts` and the shared strong-model functions in `gemini.ts`; do not fork Study Guide or Study Pack prompts per provider unless the provider genuinely requires different transport/schema handling.
- Update UI labels/options in `SettingsDialog.tsx`, `TopNavBar.tsx`, and any embedded creation surfaces that display provider labels or progress estimates. Strong providers should display their real label, not fall back to Basic or Gemini copy.
- Update dashboard chat in `apps/studymesh/src/dashboardChat/askDashboard.ts` if the provider needs different chat transport. It should use the same strong-provider credentials and adapter, so selecting a strong provider in Settings affects chat too.
- Keep image extraction explicit: only providers marked as supporting image input should receive inline images. Text-only strong providers should fall back to existing OCR, Gemini vision, or Local AI image paths rather than pretending they can read images.
- Add tests in `apps/studymesh/tests/unit/studyPack/studyPackAi.test.ts` for credential separation, env fallback, request shape, rate-limit/auth errors, and any schema conversion needed by the new provider.

## AI Generation File Map

Most current AI-mode work is in the StudyMesh app under `apps/studymesh/src/studyPack/ai/`, the unified workspace creation shell, and the two older creation components under `apps/studymesh/src/components/studyPack/`.

- Provider selection and routing: `apps/studymesh/src/studyPack/ai/provider.ts` chooses Basic fallback, Google local AI, Own Gemini API token, or the future hosted-token provider for Study Pack and Study Guide generation. Start here when changing mode behavior or fallback rules.
- Provider settings: `apps/studymesh/src/studyPack/ai/settings.ts` stores the selected provider, Gemini token, model, and `GEMINI_API_KEY` environment fallback. Settings UI lives in `apps/studymesh/src/components/WidgetEditor/components/dialogs/SettingsDialog.tsx`.
- Public AI exports: `apps/studymesh/src/studyPack/ai/index.ts` re-exports the AI helpers used by UI and tests.
- Unified Creation panel and workspace responsive shell: `apps/studymesh/src/components/workspace/WorkspaceStudioShell.tsx` owns the left Creation panel, mobile/tablet Creation/Dashboards/AI Chat switcher, quick-create actions, creation drafts/status markers, and embedding of the older Study Guide and Create From Notes components.
- Create From Notes/Create Study Pack UI: `apps/studymesh/src/components/studyPack/CreateStudyPackModal.tsx` is now embedded in the Creation panel for source-driven creation. It handles pasted notes, uploaded text files, image extraction, provider-specific progress, and final Study Pack creation.
- Create Study Guide UI: `apps/studymesh/src/components/studyPack/CreateStudyPathModal.tsx` is now embedded in the Creation panel for the prompt-required slow creation path. It handles prompt-to-tutorial generation, Study Guide size choices, local-AI concurrency, provider-specific progress, and Local AI failure debug output.
- Gemini API mode: `apps/studymesh/src/studyPack/ai/gemini.ts` contains Gemini prompts, strict JSON parsing, retry/repair behavior, image note extraction, Study Pack generation, and Study Guide dashboard generation. Use this for Own Gemini API token changes.
- Google local AI mode: `apps/studymesh/src/studyPack/ai/localLanguageModel.ts` wraps Chrome built-in AI availability checks, session creation, prompting, timeouts, smoke tests, cooldowns, and image input. `apps/studymesh/src/studyPack/ai/localGeneration.ts` contains Local AI JSON parsing/repair, Study Pack generation, Study Guide planning, dashboard generation, concurrency, and Basic fallback Study Guide generation.
- Basic fallback mode: `apps/studymesh/src/studyPack/parser.ts`, `apps/studymesh/src/studyPack/generator.ts`, `apps/studymesh/src/studyPack/practice.ts`, and the Basic branches in `apps/studymesh/src/studyPack/ai/provider.ts` provide non-AI parsing and exercise generation. Basic image extraction uses `apps/studymesh/src/studyPack/imageOcr.ts`.
- Image OCR and image-to-notes paths: `apps/studymesh/src/studyPack/imageOcr.ts` uses Tesseract for Basic OCR, Gemini image extraction is in `gemini.ts`, and Local AI image extraction is in `localLanguageModel.ts`. The modal decision tree is in `CreateStudyPackModal.tsx`.
- Normalization and contracts: `apps/studymesh/src/studyPack/ai/normalizer.ts` maps strict AI output into study objects and enforces Study Guide dashboard role constraints.
- Shared Study Pack types and exports: `apps/studymesh/src/studyPack/types.ts` and `apps/studymesh/src/studyPack/index.ts` define and expose the study object model used by all generation modes.

Tests for these flows are mainly in `apps/studymesh/tests/unit/studyPack/studyPackAi.test.ts`, `apps/studymesh/tests/unit/studyPack/studyPackGenerator.test.ts`, `apps/studymesh/tests/unit/studyPack/studyPackParser.test.ts`, `apps/studymesh/tests/unit/studyPack/imageOcr.test.ts`, `apps/studymesh/tests/unit/components/studyPack/CreateStudyPackModal.test.tsx`, and `apps/studymesh/tests/unit/components/studyPack/CreateStudyPathModal.test.tsx`.

## Build, Test, and Development Commands

Run commands from the repository root unless noted:

- `npm install` installs workspace dependencies.
- `npm start` runs `turbo start` for app dev servers.
- `npm run build` runs production builds through Turbo.
- `npm test` runs package test tasks.
- `npm run format` formats `ts`, `tsx`, and `md` files with Prettier.
- `npm --workspace studymesh run test:unit` runs StudyMesh Vitest unit tests.
- `npm --workspace studymesh run test:e2e` runs StudyMesh Playwright tests.
- `npm --workspace studymesh run test:snapshot` updates Playwright snapshots.
- `npm --workspace studymesh run twd:relay` starts the TWD relay for cheap in-browser smoke tests.
- `npm --workspace studymesh run test:twd` runs the StudyMesh TWD smoke tests against the active dev app.

For hook tests, run `tools/git-hooks/lib/bashunit tools/git-hooks/tests`.

## Coding Style & Naming Conventions

Use TypeScript/React patterns already present in each app. Components use PascalCase filenames such as `WidgetEditor.tsx`; hooks use `useX.ts`; SCSS modules use `*.module.scss`. StudyMesh ESLint requires 2-space indentation, no semicolons, `eqeqeq`, and braces for all control blocks. Prefer named exports for reusable shared code and keep app-specific code inside its app boundary.

## Testing Guidelines

Use Vitest with React Testing Library for unit tests and Playwright for end-to-end coverage. Name unit tests `*.test.ts` or `*.test.tsx`; name e2e specs `*.spec.ts`. Keep snapshots in the existing `*-snapshots` folders and update them only when the visual change is intentional.

StudyMesh also has TWD smoke tests in `apps/studymesh/src/twd/`. Use TWD when a fast browser check is enough for happy paths such as landing to login, signup/login to `/workspace`, opening Application Settings, or deleting the toy `profiles` row. Keep these tests short and workflow-level. Do not replace Vitest unit tests or Playwright e2e/visual coverage with TWD; use TWD to avoid expensive full-browser runs while developing narrow UI/auth flows.

## Commit & Pull Request Guidelines

Commit history uses prefixed subjects, for example `StudyMesh:MAIN Make admin the default user`. Install the hook with `tools/git-hooks/init.sh` to auto-prefix commit messages. Keep subjects imperative and specific.

Pull requests should describe the change, list tested commands, link related issues, and include screenshots or snapshot notes for UI changes. Mention affected apps or packages, especially for module federation, shared UI, or theme changes.

## Security & Configuration Tips

Do not commit secrets or local environment files. Keep deployment config changes in `vercel.json` coordinated with app-level webpack configs, since the project relies on Turbo and module federation paths.
