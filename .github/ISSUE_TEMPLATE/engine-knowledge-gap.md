---
name: Engine-side knowledge gap
about: The skill came up short while you were modifying the Marinara Engine codebase itself
title: "[engine gap] "
labels: engine-coverage
---

<!--
This skill is strong on user-facing work (characters, lorebooks, tools, agents,
macros, themes, extensions) and on contribution *process* (branching, gates,
approvals, PR hygiene). It is deliberately thin on the engine's interior —
none of the very large files has been read end to end.

If it let you down on real engine work, that's the signal that tells us where
to build coverage first. Rough notes are fine; don't polish this.
-->

## Which area let you down?

<!-- File, route, subsystem. e.g. generate.routes.ts, the agent pipeline,
     Game state machine, prompt assembly, Noodle, the capability API. -->

## What were you trying to do?

<!-- One or two sentences. "Add a field to X and have it reach the prompt",
     "figure out why agent Y fires twice", etc. -->

## What did you need to know that the skill couldn't tell you?

<!-- The specific missing knowledge. Common shapes:
     - a call path ("what actually invokes this")
     - a data flow ("where does this value come from / end up")
     - where state really lives
     - which of several similar-looking functions is the live one
     - an invariant you only discover by breaking it -->

## What did you do instead?

<!-- Usually "read N thousand lines until I found it." Saying roughly how long
     it took is genuinely useful for prioritising. -->

## Engine version

<!-- e.g. v2.4.0, or the staging commit you were on. -->

## Anything you learned worth writing down?

<!-- Optional, and the most valuable box on this form. If you worked it out,
     what you learned is exactly what the reference should have said. Paste it
     here however roughly and it can become the fix. -->
