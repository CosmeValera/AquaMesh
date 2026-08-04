---
name: commit
description: Stage and commit the current changes in this repo with a well-formed message. Use when the user says "commit", "commit this", "/commit", or asks to save the current changes as a commit.
---

Commit the repo's current changes. Follow this repo's conventions, not generic ones.

## Steps

1. Run in parallel: `git status`, `git diff` (staged + unstaged), `git log --oneline -10`.
2. If there is nothing to commit (no staged or unstaged changes, no untracked files relevant to the work), say so and stop. Do not create an empty commit.
3. Review the diff. If anything looks like a secret (`.env`, credentials, tokens, private keys) or an unrelated file the user didn't ask about, flag it and exclude it rather than staging blindly.
4. Stage only the specific files relevant to the change, by name. Never `git add -A` or `git add .`.
5. Draft the commit message:
   - Imperative mood, present tense: "add", "fix", "remove" — not "added"/"adds".
   - Subject line only when the diff is self-explanatory; add a short body only for non-obvious *why* (a bug's root cause, a constraint, a tradeoff).
   - Do **not** prepend `RabbitHole:DEV` / `RabbitHole:MAIN` yourself — `tools/git-hooks/prepare-commit-msg.sh` adds that prefix automatically if the hook is installed. Write a plain, unprefixed subject.
   - **Never** add a `Co-Authored-By: Claude` trailer or any AI-attribution line. This repo's standing rule forbids it — see memory `no-claude-coauthor-trailer`.
   - Pass the message via a heredoc so formatting survives.
6. Commit with `git commit -m "$(cat <<'EOF' ... EOF)"`.
7. If a pre-commit hook fails, fix the underlying issue, re-stage, and create a **new** commit. Never amend to work around a failed hook, and never use `--no-verify` unless the user explicitly says to.
8. Run `git status` after to confirm the working tree is clean (or shows only what's expected).
9. Report the commit hash and subject. Do not push — pushing is a separate, explicit request.

## Boundaries

- Never use `git commit --amend` unless the user explicitly asks for an amend.
- Never force-push, reset --hard, or run any destructive git command as part of this skill.
- If the user asked to commit "everything" but the diff includes changes unrelated to the current task, ask before bundling them in.
