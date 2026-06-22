# Marinara Engine Expert Skill

A Claude skill that handles two kinds of Marinara Engine work:

- **Ideation** — designing characters, lorebooks, custom tools, agents, and extensions for users *building things in* Marinara.
- **Contribution** — triaging PRs, reproducing bugs, diagnosing issues, and shipping focused changes to *the Marinara codebase itself*.

The skill detects which mode the user needs from context and switches its workflow accordingly.

## What it does

**In ideation mode**, the skill identifies which Marinara Engine surfaces the user's idea touches (character card, lorebook, custom tool, agent, extension), presents 2–4 architecture options with honest tradeoffs, recommends one with rationale, then offers to build it — but first asks for a concrete behavioral spec rather than letting the model guess.

**In contribution mode**, the skill triages open PRs by urgency, requires reproducing bugs on a real local install before proposing fixes, drives diagnosis through the dev console + network tab + server logs, and walks through implementations one focused change at a time.

It also enforces a mandatory pre-submission checklist before any PR is declared "ready" — pnpm check green, the user has actually run the app and clicked through the feature, light + dark mode tested, mobile viewport tested, empty and error states tested, before/after screenshots for UI changes. Most importantly, it treats AI-generated test plans as a to-do list for the human contributor, not as evidence of testing — a hard rule against the common failure mode where AI-ticked checkboxes claim work that never actually happened. Anti-patterns and behavioral rules are drawn from how the engine's maintainers actually work with AI tools.

**Built for beginners too.** The skill is tuned to assume the user may be brand new to coding, git, or development tooling. Before any significant action — opening a file, running a command, branching, editing code — Claude narrates what it's doing and why in plain-language analogies, then pauses so the user can follow along instead of silently batching changes. Concepts like branches, `pnpm check`, agents, and pattern-matching get explained the first time they come up, then dropped if the user demonstrates fluency. The goal: a hobbyist contributor with zero CS background can ship a working PR.

The skill enforces every rule in CONTRIBUTING.md — server-side logging via Pino, link-the-issue PR bodies, in-same-PR doc updates, and version-drift checks across all 10 version-bearing files.

## Knowledge architecture

The skill uses three tiers of authority:

- **References** cover stable conceptual material — what agents are, how the decision hierarchy works, what fields a character card has — that remains consistent across releases.
- **Live repo lookups** address current features and recent additions. The skill instructs Claude to fetch from `github.com/Pasta-Devs/Marinara-Engine` rather than guess at "does feature X exist in 2.0 yet?"
- **User input** fills in behavior-level details: when implementing, Claude asks for the concrete spec rather than inferring it.

This structure acknowledges that the alternative — confident-sounding answers built on unverified assumptions about a moving target — is worse.

## Included materials

- `SKILL.md` — main skill instructions covering both modes
- `references/` — six condensed reference files (architecture, character cards, lorebooks, custom tools, extensions, agents, decision guide)
- `assets/` — JSON and Markdown starter templates for character cards, custom agents, lorebook entries, and webhook tools

## When it activates

The skill triggers when users mention Marinara Engine, Professor Mari, SpicyMarinara, or describe building characters, tools, extensions, or agents for AI chat frontends. It also triggers for contributor work — reviewing PRs, fixing bugs, or shipping changes to the Marinara repo.

## License

MIT. Pull requests welcome, especially for outdated content as the engine evolves.
