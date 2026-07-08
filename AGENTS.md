# Repository Guidelines

## Command Wrapper

Always prefix shell commands with `rtk`. For PowerShell built-ins or syntax that are not standalone executables, run them through PowerShell under the wrapper, for example `rtk powershell -NoProfile -Command "Get-ChildItem -Force"`.

## LeanCTX Context Cache

Use LeanCTX MCP tools when available for cached repo exploration, repeated file reads, broad search, tree views, and context retrieval in this large repository. For normal StudyMesh app work, scope LeanCTX calls to `apps/studymesh` first instead of the repository root.

Default LeanCTX workflow:

- Use `ctx_compose` first for broad code questions or before editing unfamiliar behavior.
- Use `ctx_glob`, `ctx_search`, and `ctx_read` for targeted file discovery, search, and reads. Prefer `ctx_read` modes `signatures`, `map`, or `lines:N-M`; use `full` only when exact edit context is needed.
- Use `ctx_tree` only on scoped directories such as `apps/studymesh` or `apps/studymesh/src`, with shallow depth. Avoid repository-root `ctx_tree` scans unless explicitly needed because they can time out on this monorepo.
- Prefer cache hits and focused LeanCTX reads over repeated full-file reads. Avoid `ctx_compare` or broad compression previews on large files unless explicitly investigating token usage because they can print huge diffs.

Use LeanCTX for repo context tools (`ctx_compose`, `ctx_glob`, `ctx_search`, `ctx_read`, `ctx_tree`). Do not use LeanCTX `ctx_shell` for commands in this repo because it may block `rtk`; run shell commands through the normal shell tool with the required `rtk` prefix. Do not enable LeanCTX shell hooks unless explicitly requested.

If LeanCTX is unavailable, fall back to normal `rg`, file reads, and `rtk`-wrapped shell commands.

## Project Structure & Module Organization

StudyMesh is an npm/Turborepo monorepo. Root npm workspaces currently include only `apps/studymesh`; treat `apps/control-flow`, `apps/system-lens`, and `packages/` as legacy/not wired into the active workspace unless a task explicitly targets them. Theme and PrimeReact SCSS sources are under `style/`. Documentation images and tutorials are in `readme_docs/`. Git hook utilities are in `tools/git-hooks/`.

Within each app, source files are in `src/`, public assets are in `public/`, and build output goes to `dist/`. StudyMesh tests are split into `apps/studymesh/tests/unit` and `apps/studymesh/tests/e2e`.

## Product Direction & Core Workflows

StudyMesh is a student knowledge wiki. The main product goal is helping students turn prompts and current dashboard context into useful tutorials, study dashboards, widgets, exercises, and reusable workspace views without forcing them to manually design dashboards or widgets first.

Keep the main StudyMesh experience clear about the current primary workflows:

- Creation panel: Create Study Guide and Quick Create live in one Creation section in the workspace shell. This is the main creation entry point future work should preserve. In code, the workflow branches are `study-path` for prompt-based Study Guides and Quick Create for fast dashboard-context generation.
- Fast creations: the Quick Create actions in the Creation panel default to one-click generation from the currently active dashboard context and produce focused widgets/dashboards such as quizzes, flashcards, or podcasts. Do not reintroduce pasted-note, file-upload, OCR, PDF, PowerPoint, or general external-source ingestion flows; users who want source-driven material generation should use NotebookLM. The allowed exception is dashboard chat's web-source lookup and its "add source to Study Guide" page flow.
- Slow creation: the Study Guide path intentionally requires the user to write a prompt. Treat it as the app's highest-value feature: a user can write only a learning goal and receive a full tutorial-style, multi-dashboard Study Guide with lessons, study widgets, and exercises for whatever they want to learn.
- Advanced path: manually create a widget or dashboard. This is the least ideal path for beginner students and should gradually become less prominent. In the future, it may be hidden behind a settings option that enables advanced creation actions in the top navigation menu.
- Workspace path: open an existing Study Guide tutorial, Quick Create result, or custom dashboard in the main workspace for study, editing, and reuse.

Creation flows should support several generation modes. Use Quick Create for fast dashboard-context generation. Do not add legacy source-driven creation compatibility unless explicitly requested.

Responsive workspace model:

- Phone and tablet: the app behaves like three peer sections with equal navigation weight: Creation, Dashboards, and AI Chat. The bottom section switcher in `WorkspaceStudioShell` is the mental model to preserve.
- Desktop: Dashboards are the primary workspace. The dashboard canvas uses `flexlayout-react` so users can position widgets inside dashboards. Creation sits as a left rail/resizable panel and AI Chat sits as a right rail/resizable panel. Users may keep both side panels open, one open, or both collapsed to focus on dashboards.

Generation modes:

- Basic fallback: does not use AI. It parses dashboard-context text programmatically from keywords and obvious structure. It is instantaneous, but usually produces weak results. This mode only supports Quick Create flows, not Study Guide.
- Gemini API token: bring-your-own Gemini token/key. This is the preferred high-quality path for users who already have an API key and want richer AI-generated study materials.
- Google local AI: runs free and locally, with no internet connection required. Results are usually worse than hosted/BYO strong providers, but better than Basic fallback. Local AI failures should surface errors/debug output; do not silently fall back to Basic for Study Guide generation.
- Hosted AI / Study Credits: implemented as `provider: 'hosted'` with app-owned hosted calls and Study Credits. Costs, initial credits, and refill packs live in `apps/studymesh/src/quickCreate/ai/hostedCredits.ts`; do not hardcode credit economics in UI copy or prompts.

Generation flows are currently embedded in the Creation panel. Opening an existing Study Guide tutorial, Quick Create result, or custom dashboard should take the user into the main workspace rather than sharing the same creation setup flow.

Web-grounded sources: dashboard chat can fetch Tavily-backed web sources through `/api/dashboard-source` when `askDashboardSources` reports a source gap. Study Guide prompt generation does not currently web-search. If adding web-grounded Study Guide research for obscure/latest prompts, do deterministic pre-generation lookup, prefer official/local repo docs for private tool topics, and source-lock generated claims. Source-page drafting from an already fetched chat source must not perform a second web lookup.

Strong AI provider model:

- Strong AI providers are BYO hosted text models that can run the shared high-quality Quick Create, Study Guide, and dashboard-chat prompts. Gemini and Cerebras are the current examples. Hosted AI is a separate `hosted` provider backed by the app gateway, not the same as BYO Cerebras. Google Local AI is intentionally separate because it is weaker, browser-local, and has its own orchestration/fallback constraints.
- Add new hosted strong providers in one place first: `apps/studymesh/src/quickCreate/ai/strongProviders.ts`. Extend `StrongAiProviderId`, add the config entry in `STRONG_AI_PROVIDERS`, implement the provider call adapter if it is not OpenAI/Gemini-compatible, and keep the adapter returning plain text.
- Strong provider settings are provider-keyed in `apps/studymesh/src/quickCreate/ai/settings.ts` under `strongProviders`, with legacy `apiToken`/`model` mapped to Gemini for compatibility. API tokens should stay in session/env storage, not localStorage. Add the provider env var helper there only if the registry does not already cover it.
- Route generation through `apps/studymesh/src/quickCreate/ai/provider.ts` and the shared strong-model functions in `strongGeneration.ts`; do not fork Study Guide or Quick Create prompts per provider unless the provider genuinely requires different transport/schema handling.
- Update UI labels/options in `SettingsDialog.tsx`, `TopNavBar.tsx`, and any embedded creation surfaces that display provider labels or progress estimates. Strong providers should display their real label, not fall back to Basic or Gemini copy.
- Update dashboard chat in `apps/studymesh/src/dashboardChat/askDashboard.ts` if the provider needs different chat transport. It should use the same strong-provider credentials and adapter, so selecting a strong provider in Settings affects chat too.
- Keep image input explicit: Quick Create currently uses dashboard context, not file/image source ingestion. Do not send user files or inline images to providers unless a new explicit product direction restores that workflow.
- Add tests in `apps/studymesh/tests/unit/quickCreate/quickCreateAi.test.ts` for credential separation, env fallback, request shape, rate-limit/auth errors, and any schema conversion needed by the new provider.

## AI Generation File Map

Most current AI-mode work is in the StudyMesh app under `apps/studymesh/src/quickCreate/ai/`, the unified workspace creation shell, and the Study Guide creation component under `apps/studymesh/src/components/studyGuides/`.

- Provider selection and routing: `apps/studymesh/src/quickCreate/ai/provider.ts` chooses Basic fallback, Google local AI, Hosted AI/Study Credits, or BYO strong providers for Quick Create and Study Guide generation. Start here when changing mode behavior or fallback rules.
- Provider settings: `apps/studymesh/src/quickCreate/ai/settings.ts` stores the selected provider, session provider tokens, models, and environment fallback. Settings UI lives in `apps/studymesh/src/components/settings/SettingsDialog.tsx`.
- Public AI exports: `apps/studymesh/src/quickCreate/ai/index.ts` re-exports the AI helpers used by UI and tests.
- Unified Creation panel and workspace responsive shell: `apps/studymesh/src/components/workspace/WorkspaceStudioShell.tsx` and `WorkspaceStudioLayouts.tsx` own the left Creation panel, mobile/tablet Creation/Dashboards/AI Chat switcher, Quick Create actions, creation drafts/status markers, and embedded Study Guide creation. Preserve the Creation, Dashboards, AI Chat mobile tab labels/order unless product direction changes.
- Study Guide UI: `apps/studymesh/src/components/studyGuides/CreateStudyGuideModal.tsx` is embedded in the Creation panel for the prompt-required slow creation path. It handles prompt-to-tutorial generation, Study Guide size choices, local-AI concurrency, provider-specific progress, and Local AI failure debug output.
- Strong AI mode: `apps/studymesh/src/quickCreate/ai/strongGeneration.ts` contains hosted-model prompts, strict JSON parsing, retry/repair behavior, Quick Create generation, and Study Guide dashboard generation.
- Google local AI mode: `apps/studymesh/src/quickCreate/ai/localLanguageModel.ts` wraps Chrome built-in AI availability checks, session creation, prompting, timeouts, smoke tests, and cooldowns. `apps/studymesh/src/quickCreate/ai/localGeneration.ts` contains Local AI JSON parsing/repair, Quick Create generation, Study Guide planning, dashboard generation, concurrency, retries, and debug output.
- Dashboard chat web sources: `apps/studymesh/src/dashboardChat/externalSources.ts`, `sourcePageDrafts.ts`, and `/api/dashboard-source` handle Tavily search/extract, answer retry with fetched source IDs, and Study Guide page drafting from already fetched web sources.
- Basic fallback mode: `apps/studymesh/src/quickCreate/generator.ts`, `apps/studymesh/src/quickCreate/practice.ts`, and the Basic branches in `apps/studymesh/src/quickCreate/ai/provider.ts` provide non-AI parsing and exercise generation from dashboard context.
- Normalization and contracts: `apps/studymesh/src/quickCreate/ai/normalizer.ts` maps strict AI output into study objects and enforces Study Guide dashboard role constraints.
- Shared Quick Create types and exports: `apps/studymesh/src/quickCreate/types.ts` and `apps/studymesh/src/quickCreate/index.ts` define and expose the study object model used by all generation modes.
- Study Guide seed content: `apps/studymesh/src/studyGuides/studyMeshGuideSeed.ts` owns the built-in StudyMesh guide seed.
- Strong AI session key dialog: `apps/studymesh/src/components/ai/StrongAiSessionKeyDialog.tsx`.

Tests for these flows are mainly in `apps/studymesh/tests/unit/quickCreate/quickCreateAi.test.ts`, `apps/studymesh/tests/unit/quickCreate/studyPathContainer.test.ts`, `apps/studymesh/tests/unit/quickCreate/localAiSessionManager.test.ts`, `apps/studymesh/tests/unit/components/studyGuides/CreateStudyGuideModal.test.tsx`, `apps/studymesh/tests/unit/components/workspace/workspaceStudioModel.test.ts`, `apps/studymesh/tests/unit/components/settings/SettingsDialog.test.tsx`, `apps/studymesh/tests/unit/components/dashboardChat/DashboardChatPanel.test.tsx`, `apps/studymesh/tests/unit/dashboard/sourcePageDrafts.test.ts`, `apps/studymesh/tests/unit/api/apiHardening.test.ts`, and `apps/studymesh/tests/unit/studyGuides/studyMeshGuideSeed.test.ts`.

## Build, Test, and Development Commands

Run commands from the repository root unless noted:

- `npm install` installs workspace dependencies.
- `npm start` runs Vercel dev for the app plus serverless API routes.
- `npm run start-dev` runs Turbo `start` tasks for app dev servers.
- `npm --workspace studymesh run start` runs the StudyMesh webpack dev server directly.
- `npm run build` runs production builds through Turbo.
- `npm test` runs package test tasks.
- `npm run lint` runs Turbo lint tasks.
- `npm run format` formats `ts`, `tsx`, and `md` files with Prettier.
- `npm --workspace studymesh run test:unit` runs StudyMesh Vitest unit tests.
- `npm --workspace studymesh run test:e2e` runs StudyMesh Playwright tests.
- `npm --workspace studymesh run test:snapshot` updates Playwright snapshots.
- `npm --workspace studymesh run twd:relay` starts the TWD relay for cheap in-browser smoke tests.
- `npm --workspace studymesh run test:twd` runs the StudyMesh TWD smoke tests against the active dev app.
- `npm --workspace studymesh run test:twd:one -- <test>` runs one TWD smoke test through the relay.

For hook tests, run `npm run bashunit`.

## Coding Style & Naming Conventions

Use TypeScript/React patterns already present in each app. Components use PascalCase filenames such as `WidgetEditor.tsx`; hooks use `useX.ts`; SCSS modules use `*.module.scss`. StudyMesh ESLint requires 2-space indentation, no semicolons, `eqeqeq`, and braces for all control blocks. Prefer named exports for reusable shared code and keep app-specific code inside its app boundary.

StudyMesh workspace/settings UI should prefer MUI components and `@mui/icons-material`. PrimeReact styles remain globally loaded for legacy areas; do not introduce a second icon/UI system unless replacing a pattern globally.

## UI Contrast Requirements

Icon-only controls must not rely on default MUI `IconButton` colors. For toolbar/navigation/destructive icon buttons, always set explicit `color`, `bgcolor`, `borderColor`, hover styles, and disabled styles with readable contrast in both light and dark themes. This is required for page navigation, reorder, delete, close/open, resize-adjacent, and similar controls on desktop and phone/tablet. Disabled icons may be muted, but they must remain visibly intentional, not nearly invisible.

Creation cards and compact controls need stable dimensions, explicit hover/disabled styling, and no layout shift while generation status changes.

## Testing Guidelines

Use Vitest with React Testing Library for unit tests and Playwright for end-to-end coverage. Name unit tests `*.test.ts`, `*.test.tsx`, `*.spec.ts`, or `*.spec.tsx`; name e2e specs `*.spec.ts`. Keep snapshots in the existing `*-snapshots` folders and update them only when the visual change is intentional. Playwright e2e expects the dev app/server to be managed externally unless its config is explicitly changed.

StudyMesh also has TWD smoke tests in `apps/studymesh/src/twd/`. Use TWD when a fast browser check is enough for happy paths such as landing to login, signup/login to `/workspace`, opening Application Settings, or deleting the toy `profiles` row. Keep these tests short and workflow-level. Do not replace Vitest unit tests or Playwright e2e/visual coverage with TWD; use TWD to avoid expensive full-browser runs while developing narrow UI/auth flows.

## Commit & Pull Request Guidelines

Commit history uses prefixed subjects, for example `StudyMesh:DEV Make admin the default user` or `StudyMesh:MAIN Make admin the default user` depending on branch/environment. Install the hook with `tools/git-hooks/init.sh` to auto-prefix commit messages. Keep subjects imperative and specific.

Pull requests should describe the change, list tested commands, link related issues, and include screenshots or snapshot notes for UI changes. Mention affected apps or packages, especially for module federation, shared UI, or theme changes.

## Security & Configuration Tips

Do not commit secrets or local environment files. Keep deployment config changes in `vercel.json` coordinated with app-level webpack configs, since the project relies on Turbo and module federation paths.
