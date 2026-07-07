# Study Guide Hybrid Generation Options

Purpose: record implementation deltas for mini/nano generation options so later work can combine them without re-discovering the wiring.

## Shared Evaluation Harness

- Add `apps/studymesh/scripts/hybrid-study-guide-eval.ts`.
- Uses `HOSTED_OPENAI_API_KEY` or `OPENAI_API_KEY`.
- Forces `gpt-5.4-mini` and `gpt-5.4-nano` so env routing does not hide model choice.
- Records per-stage token usage and USD estimate with current configured prices:
  - mini input/cached/output: `0.75 / 0.075 / 4.50` USD per 1M tokens.
  - nano input/cached/output: `0.20 / 0.02 / 1.25` USD per 1M tokens.
- Writes full generated outputs and compact quality signals to `apps/studymesh/evals/study-guide-hybrid-results.json`.

## Option 1: Mini Main, Nano Support

Product delta:

- Keep current `study_guide_main` on mini.
- Route these support stages to nano:
  - `quick_start_relevance_auto`
  - `quick_start_personalized`
  - `quick_start_relevance_force`
  - `quick_start_forced_bridge`
  - `knowledge_bridge_blocks`
- Keep existing fallback behavior: main guide remains valid even when nano support fails.

Eval-specific additions:

- Use hard known-topic selection cases.
- Check if nano selects expected known topic.

## Option 2: Mini Main Without Quiz, Nano Final Quiz

Product delta:

- Modify lean main prompt/schema so mini generates:
  - quickStart
  - 3 lesson pages
  - no practice quiz
- Add a post-main nano call:
  - input: final page notes plus guide summary
  - output: 5-6 multiple-choice questions
  - constraints: application/comparison/error-diagnosis questions, not literal page recall
- Merge nano quiz into final dashboard.

Eval-specific additions:

- Count quiz bad-smell stems such as `According to`, `Which statement is directly stated`, and generic copied-line recall.

## Option 3: Mini Planner, Nano Page Writers, Mini Validator

Product delta:

- Mini planner outputs compact blueprint:
  - title
  - quickStart
  - 3 page titles
  - learning goals
  - must-cover bullets
  - examples/code requirements
  - final quiz skills
- Nano writes each page separately from its page plan.
- Nano creates final quiz from plan + final page.
- Mini validates assembled guide and returns score/issues.
- Optional later repair path: if validator score < threshold, mini repairs only failing page/quiz.

Eval-specific additions:

- No repair yet unless selected for final implementation; this qualifier measures raw viability.

## Option 4: Mini Blueprint, Nano Expansion

Product delta:

- Mini writes compact but factual complete blueprint:
  - quickStart
  - page titles
  - key facts
  - short notes
  - examples needed
  - final quiz skills
- Nano expands each page using only blueprint facts.
- Nano final quiz uses blueprint + expanded final page.
- Deterministic checks catch missing pages, weak length, missing quiz.

Eval-specific additions:

- Nano prompt explicitly forbids adding facts not implied by mini blueprint.

## Option 4 Enhanced + Option 2

Product delta:

- Same architecture as Option 4:
  - mini owns facts, structure, quickStart, and context bridge planning.
  - nano expands pages from the mini blueprint.
  - nano creates the 6-question final quiz.
- Enhanced blueprint prompt adds:
  - learner context candidates and expected bridge target for evaluation.
  - complete-sentence constraints for quickStart and page notes.
  - stronger fact density per page.
  - explicit real code/config/example requirements for technical topics.
  - placeholder bans such as `example_resource`, `arguments would go here`, and `component logic goes here`.
- Enhanced page prompt adds:
  - complete final sentence requirement.
  - no unfinished list or dangling connector ending.
  - real fenced snippet only when the blueprint supports it.
  - use prose instead of fake code if a real snippet is not supported.
- Shared Quick Start sanitizer now allows a small overrun to finish the current sentence instead of hard-cutting at the word cap.

Eval-specific additions:

- Run with `--enhanced-only` to generate only four enhanced guides and compare local metrics against the saved 4+2 baseline.
- No OpenAI evaluator calls in this mode.

## Option 5: Nano Draft, Mini Judge/Fallback

Product delta:

- Try current lean full Study Guide with nano.
- Deterministic validator checks schema/page/quiz/code minimums.
- Mini judge scores content quality.
- If nano parse/schema/quality fails, rerun current mini main path.

Eval-specific additions:

- Report whether final used nano or fell back to mini and total blended cost.

## Option 6: Router By Topic

Product delta:

- Add pre-generation router:
  - technical/framework/basic tool topics: use mini blueprint + nano expansion or mini planner + nano pages.
  - high-risk history/science/medicine/legal/current events: keep mini main.
  - optional forced context bridge: nano acceptable because user can ignore it.
- Router can be deterministic keyword-first, later model-assisted if needed.

Eval-specific additions:

- Qualifier uses one technical infrastructure prompt and reports selected route.
