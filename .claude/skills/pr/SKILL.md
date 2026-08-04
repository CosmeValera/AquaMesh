---
name: pr
description: Open a pull request for the current branch against main, with a title and body that follow this repo's conventions. Use when the user says "open a PR", "create a pull request", "/pr", or asks to ship the current branch.
---

Open a GitHub PR for the current branch. This repo is a Turborepo/npm-workspaces monorepo; the PR body needs to say what it touches, not just what changed.

## Steps

1. Run in parallel: `git status`, `git diff main...HEAD` (or the actual base branch), `git log main..HEAD --oneline`, and check whether the branch tracks a remote / is pushed.
2. Read every commit in the range, not just the latest — the PR body has to cover the whole branch, not the last commit.
3. If there are uncommitted changes, stop and ask whether to commit them first (use the `commit` skill) or leave them out of the PR.
4. Draft:
   - **Title**: under 70 chars, imperative, no `RabbitHole:DEV`/`RabbitHole:MAIN` prefix (that prefix is for commit subjects via the local hook, not PR titles).
   - **Body**, per this repo's convention:
     - Summary: 1-3 bullets of what changed and why.
     - Affected apps/packages: call out `apps/studymesh`, module federation, shared UI, or theme changes explicitly if touched.
     - Test plan: checklist of what was run (`npm --workspace studymesh run test:unit`, lint, manual checks) and what's still unverified.
     - Screenshots or snapshot notes for any UI change — ask the user for a screenshot if one isn't available and the change is visual.
5. Push the branch if it isn't already pushed (`git push -u origin <branch>`), then `gh pr create --title "..." --body "$(cat <<'EOF' ... EOF)"`.
6. Return the PR URL.

## Boundaries

- Never force-push to open or update a PR.
- Never push directly to `main`.
- If the branch has no commits ahead of the base, say so instead of creating an empty PR.
- Don't invent a test plan item that wasn't actually run — list what's unverified as unverified.
