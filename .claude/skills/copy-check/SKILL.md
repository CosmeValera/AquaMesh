---
name: copy-check
description: Review new or changed user-facing text against RabbitHole's product voice and naming rules before it ships. Use when the user says "check this copy", "copy-check", "/copy-check", or asks for a review of button labels, dialog text, or other UI strings.
---

Review user-facing strings against RabbitHole's product conventions before they land. This is a voice/naming check, not a grammar check.

## Steps

1. Collect the strings to review: from the current diff (new/changed entries in `apps/studymesh/src/language/interfaceLanguage.tsx`, or new JSX text), or from what the user pastes directly.
2. Delegate the review to the `rabbithole-product-ux` agent (per this repo's subagent policy — it's the agent scoped for this, don't hand-roll the check inline or reach for a heavier agent). Give it the actual strings plus surrounding context (what screen/flow they're in).
3. Have it check each string against CLAUDE.md's rules, specifically:
   - Hosted credits are **Carrots** in copy — never "credits" in user-facing text (code constants like `STUDY_CREDITS_LABEL` stay as-is, this is about display strings only).
   - Creation panel terms: **Create Study Guide** (prompt-required, slow path) vs **Quick Create** (dashboard-context, fast path) — don't blur the two or invent a third label.
   - No copy implying pasted-note, file-upload, OCR, PDF/PowerPoint ingestion, or other source-driven flows — those are intentionally not supported outside dashboard chat's web-source lookup.
   - Mobile/tablet section labels stay **Creation / Dashboards / AI Chat**, in that order, if the copy touches the workspace shell.
   - Brand copy says "RabbitHole"; internal `studymesh` identifiers (storage keys, CSS classes, component filenames) are never user-facing and shouldn't leak into copy.
4. Report per-string: pass, or flag with what's wrong and a suggested replacement. Don't silently rewrite the source files — the user decides which suggestions to apply.

## Boundaries

- This is English-source review only. If the string already has es/fr/de translations, note that a flagged change needs re-translating in all 4 locales (pair with `lang-check` if the edit actually happens).
- Not a substitute for `lang-check` (that's key parity/orphans) or `verify` (that's lint/types/tests) — this only judges tone and naming.
