---
name: lang-check
description: Audit apps/studymesh/src/language/interfaceLanguage.tsx for missing translation keys across locales and orphaned keys no longer referenced in code. Use when the user says "check languages", "lang-check", "/lang-check", or asks to verify i18n coverage after adding or removing copy.
---

Check translation-key health in `apps/studymesh/src/language/interfaceLanguage.tsx`. This repo supports 4 locales: `en`, `es`, `fr`, `de`, each a flat key-value map.

## Steps

1. Read `apps/studymesh/src/language/interfaceLanguage.tsx` and extract the key set for each of the 4 locale blocks.
2. **Parity check**: compare the 4 key sets. Any key present in one locale but missing from another is a bug — report it (which locale, which key). `en` is the source of truth if only one locale is short.
3. **Orphan check**: for each unique key, `grep` the rest of `apps/studymesh/src` (excluding this file) for `t('<key>')` or `'<key>'` usage. A key defined but never referenced anywhere is dead — list it as a candidate for removal.
4. **Dead-reference check** (the inverse and just as common a bug): grep `src/` for `t\('[a-zA-Z]+\.[a-zA-Z]+` call sites and confirm each resolved key actually exists in the locale map. A call site referencing a key that doesn't exist silently renders nothing at runtime — flag these as real bugs, not just cleanup.
5. Report findings as a short list: parity gaps, orphaned keys, dangling references. Do not delete or edit anything unless the user asks — this is an audit, not an auto-fix.

## Notes

- Keys use the `namespace.field` convention (e.g. `knownTopics.buttonLabel`). Group findings by namespace for readability.
- A key only used inside a `.replace('{count}', ...)` template call still counts as used — don't flag interpolated keys as orphaned just because the literal key string doesn't appear standalone.
- If asked to fix what's found, remove orphaned keys from all 4 locale blocks together (never leave a locale out of sync), and never guess translations for missing-locale gaps — ask the user for the real translation instead of inventing one.
