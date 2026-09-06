# Live Study Guide generation calls

How to generate real Study Guides against the hosted model from a script, and
how to measure the result. Everything here spends real money on the project's
own OpenAI key. Nothing here runs in CI or in `test:unit`.

**Ask the user before running anything in this folder, and agree a call budget
first.** A "call" is one Study Guide. Report how many you used when you finish.

## Why this exists

The known-topic bridge ("explain this through what I already know") cannot be
judged from unit tests. Its quality only shows up across many real topics, so
these harnesses generate real guides and score the outcome. They were written
while fixing a bug where every bridge was graded `weak`; see the bridge section
of the root `CLAUDE.md` for that history.

## Setup

Reads `.env.local` at the repo root and needs `HOSTED_OPENAI_API_KEY`. No dev
server, no Supabase, no auth — the scripts call the OpenAI Responses API
directly with the same prompt, schema, model and reasoning effort the gateway
uses, so results match production.

Run with `tsx`, from the repo root:

```bash
rtk npx tsx apps/studymesh/tests/live/bridgeLive.ts
```

## What each script does

| script | calls the model | purpose |
| --- | --- | --- |
| `bridgeLive.ts` | yes | 12 cases, monolith + final quiz. Prints the mapped pairs, the derived strength, a disclaimer-leak check, and **cost per finished guide**. Use when you want end-to-end cost or to read full output. |
| `bridgeAb.ts` | yes | 50 cases across subject families, prompt lengths and skill counts. Runs the current prompt (`new`) and/or the pre-2026-08 prompt (`old`) for a controlled comparison. Saves raw pair data as JSON. |
| `sweepRules.ts` | **no** | Scores every strength-threshold combination against saved pair data. Free. This is how thresholds get tuned. |
| `auditPairs.ts` | **no** | Prints each case with its pairs so both error directions can be judged by eye: strongs resting on weak pairs, and weaks that were a pair short. Free. |
| `oldMonolithPrompt.ts` | n/a | Verbatim copy of the pre-change prompt so the A/B stays reproducible. Do not edit. |
| `firstPageTiming.ts` | yes | 6 cases x 2 field orders. Streams the monolith and stamps first token, Quick Start, **page 1 closing**, bridge and done, then prints bridge strength and pairs per arm. Use when changing what the guide emits before page 1. |
| `checkArms.ts` | **no** | Prints both field orders and the reconstructed old prompt so the A/B arms can be checked before spending anything. Free. Run it first. |

## The workflow that matters

Do not burn calls tuning a threshold. Collect once, then sweep offline:

```bash
# 1. Collect. 50 calls. Writes bridge_raw_<tag>.json
LIVE_ARMS=new LIVE_TAG=v6 LIVE_OUT_DIR=/some/scratch \
  rtk npx tsx apps/studymesh/tests/live/bridgeAb.ts

# 2. Sweep every rule against that one collection. Free, instant.
rtk npx tsx apps/studymesh/tests/live/sweepRules.ts /some/scratch/bridge_raw_v6.json

# 3. Read the pairs behind the verdicts. Free.
rtk npx tsx apps/studymesh/tests/live/auditPairs.ts /some/scratch/bridge_raw_v6.json strong

# 4. Change the rule in src/studyGuides/quickStart.ts, then collect again to
#    validate on data the rule was not tuned against.
```

Around 60 rule variants were tested on 126 calls this way. Tuning a rule per
call instead would have cost thousands.

## Environment variables

| variable | default | meaning |
| --- | --- | --- |
| `LIVE_ARMS` | `old,new` | Which arms to run, comma separated. `new` alone is usual. In `bridgeAb.ts` an arm is a prompt version; in `firstPageTiming.ts` it is a monolith field order. |
| `LIVE_DRY_RUN` | off | `1` stops `firstPageTiming.ts` running itself on import, so `checkArms.ts` can read its arms for free. |
| `LIVE_GROUPS` | all | Only run cases whose `group` matches, comma separated (`null`, `calibration`, `human-safety`, `userset`, …). |
| `LIVE_REPEATS` | `1` | Repeats per case. Use 3 to check stability on borderline pairs. |
| `LIVE_EFFORT` | `low` | Reasoning effort. Production uses `low` for bridge stages. |
| `LIVE_TAG` | `run` | Names the raw JSON file. |
| `LIVE_OUT_DIR` | `.` | Where the raw JSON goes. Use a scratch dir, not the repo. |
| `LIVE_DUMP` | off | `1` prints the full bridged Quick Start text for every case. |

Total calls = cases × arms × repeats. Check that number before running:
`LIVE_REPEATS=3` with both arms over 50 cases is 300 guides.

## Facts worth knowing before you change anything

- **Hosted Study Guides do not use the client orchestration.** They take one
  bundled server call, `generateMonolithHostedStudyGuide` in `api/hosted-ai.ts`,
  which produces title, pages, Quick Start and the known-topic `contextPlan`
  together, then a second call for the final quiz. Prompt changes must be made
  there *and* in `apps/studymesh/src/studyGuides/quickStart.ts` for the BYO path,
  or hosted users see nothing.
- **Bridge strength is derived in code, never asserted by the model.** The model
  lists `targetParts` and `correspondences`; `deriveStudyGuideBridgeStrength`
  counts them. Asked to grade its own bridge, the model answered `weak` for every
  candidate including same-field ones.
- **Two filters were measured and rejected.** Gating on the model's own swap test
  ("would this pair fit another domain?") collapsed to ~10% strong, because a
  model asked to name a domain always names one. Requiring two `process` pairs
  produced false weaks on good structural analogies. Both are still recorded per
  pair as diagnostics so `sweepRules.ts` can re-test them; neither gates.
- **Cost** is about **$0.004 per finished guide** (monolith + quiz) at effort
  `low`. Budget accordingly.
- **Raising bridge reasoning effort was measured and rejected** (2026-08-23, 27
  cases at `LIVE_EFFORT=medium`). It did not improve discrimination and added
  variance in both directions: vaccine x fire drills fell 6 pairs to 2 while the
  false earthquake x conducting an orchestra rose 0 to 4. Error count was no
  better than `low`. Production stays at `low`; do not spend calls re-testing
  this without a new hypothesis about *why* more thinking would help.
- **Pair count is a productivity signal, not a quality one.** Before the
  2026-08-23 prompt change, `pairs >= 5` alone reproduced the shipped verdict on
  27/27 cases, so the rule was really "did the model emit 5 of a possible 6"
  while the prompt simultaneously asked it to map "as completely as you can".
  Any future threshold work should check that the prompt is not being rewarded
  for hitting the threshold. The held-out `probe`/`static`/`dynamic` groups in
  `bridgeAb.ts` exist to catch that: 15 of their 27 cases are deliberate false
  analogies, so their strong rate is *not* comparable to the 60-80% production
  band. Read the `userset` group for that.
- **Borderline pairs are genuinely flaky, and that is expected.** The same topic
  and skill can land `strong` on one run and `weak` on the next when the pair
  count sits on the threshold. Do not draw conclusions from single runs: use
  `LIVE_REPEATS=3` and compare distributions. The bug this replaced had *zero*
  variance, so some wobble is a sign of a live judgement rather than a canned
  answer.
- **Known gap**: the `carries` text is not inspected, so a mapping can pass on
  generic phrasing ("a planned series of actions", "a venue where participants
  follow shared rules") even when the side nouns are concrete. If this is
  tightened, add it as a recorded diagnostic first and let `sweepRules.ts`
  decide whether it earns a gate.
