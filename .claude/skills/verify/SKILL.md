---
name: verify
description: Run lint, TypeScript, and targeted Vitest checks on the current changes, separating real new issues from this repo's large pre-existing indent-rule noise. Use when the user says "verify", "/verify", "check my changes", or asks to confirm a change is clean before calling it done.
---

Verify the current working-tree changes are clean, without getting drowned out by this repo's pre-existing ESLint `indent` noise (large files like `StudyGuidesPage.tsx` carry 100+ pre-existing indent violations unrelated to any single change).

## Steps

1. `git status` / `git diff --stat` to get the list of changed files. If the user named specific files instead, use those.
2. **Lint**: run `npm --workspace studymesh exec eslint -- <changed files>`. For any `indent` errors on a file that existed before this change (i.e. not a brand-new file), don't assume they're yours:
   - `git show HEAD:<path>` to a scratch file, lint that copy too, and compare error counts/lines.
   - Only report indent errors that are net-new (didn't exist in the HEAD copy, or shifted into newly-added lines) as real findings.
   - For brand-new files (no HEAD copy exists), all lint errors are real — fix them.
   - Any non-`indent` rule (unused vars, react-hooks rules, no-console, etc.) is real regardless of baseline — always report those.
3. **TypeScript**: run `npm --workspace studymesh exec tsc -- --noEmit -p tsconfig.json`, then filter output to lines mentioning the changed files. Pre-existing errors in untouched files are out of scope — don't fix them, just confirm none of them are in the changed set.
4. **Tests**: find test files covering the changed source files (same basename under `tests/unit/`, or ones that import the changed module) and run them with `npm --workspace studymesh exec vitest -- run <test files>`. If a changed file has no obvious test file, say so rather than silently skipping.
5. Report a short summary: lint (clean / N real issues), tsc (clean / N real issues), tests (pass count / fail count). If everything's clean, say so plainly — don't pad it with narrative.

## Boundaries

- This skill checks; it doesn't silently rewrite unrelated code. If it finds pre-existing issues outside the changed files, mention them once and move on — don't scope-creep into fixing them unless asked.
- Never use `eslint --fix` on a file you didn't author or fully rewrite this session without asking first — bulk-reformatting someone else's pre-existing code creates unrelated diff noise.
