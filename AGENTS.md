# Agent guidance

This repository's full agent instructions live in [`CLAUDE.md`](./CLAUDE.md) —
project structure, product direction, the AI generation file map, build and test
commands, coding style, and commit conventions. Read that first. It applies to
any agent working here, not only Claude.

## Generating Study Guides from a script

If your task involves calling the AI to actually generate Study Guides — testing
generation quality, tuning the known-topic bridge, or measuring cost — read
[`apps/studymesh/tests/live/README.md`](./apps/studymesh/tests/live/README.md)
before you run anything.

It covers how to call the hosted model directly without a dev server, the
collect-once-then-sweep-offline workflow that makes threshold tuning nearly
free, cost per guide, and which filters have already been measured and rejected
so they are not rebuilt.

Those calls spend real money on the project's own API key. **Agree a call budget
with the user before running them, and report how many you used.**
