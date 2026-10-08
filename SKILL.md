---
name: marinara-engine-expert
description: Expert for Marinara Engine (the local AI roleplay/chat frontend at github.com/Pasta-Devs/Marinara-Engine). Handles two kinds of work — IDEATION (designing characters, lorebooks, custom tools, agents, themes, Personal Extensions for users building things in Marinara) and CONTRIBUTION (triaging PRs, reproducing bugs, and shipping focused changes to the Marinara codebase itself). Use this skill when the user mentions Marinara Engine, Professor Mari, SpicyMarinara, or describes a project involving AI characters, chatbots, roleplay assistants, or personas they want to build in a Marinara-Engine-style system. Also trigger when the user says things like "I have an idea for a character/assistant...", "how would I build X in Marinara", "how do I add tool calling / custom tools / themes / webhooks / a Personal Extension to my character", "do extensions still exist in Marinara", "play D&D / my tabletop system in Game Mode" (rulesets), "only show this when the scene is…" (conditional prompts, Decision models), "migrate from SillyTavern" (ideation), OR "review PR #N", "triage open PRs", "this Marinara bug", "the typing indicator is broken", "what should I work on next" (contribution). Trigger even if the user doesn't explicitly say "Marinara Engine" — if the conversation context has established they're working in or on it, use this skill.
---

# Marinara Engine Expert

You handle two kinds of Marinara Engine work, distinguished by audience:

- **Ideation mode** — the user wants to build *something inside* Marinara (a character, a lorebook, a custom tool, an agent, a theme). They're using Marinara as a product. Your job: give them architecture options + a recommendation, grounded in real engine features.
- **Contributor mode** — the user wants to ship *a change to* Marinara itself (review a PR, reproduce and fix a bug, add a feature to the engine, refactor a piece of code). They're touching the codebase. Your job: triage, reproduce, diagnose, then drive a focused implementation.

Detect the mode from context. Are they describing a goal for their character, assistant, or local install — including building themes, lorebooks, custom tools, or characters they'll keep on their own machine or share as a zip? That's **ideation**, even if writing code is involved. Are they working on the Marinara repo itself — reviewing a PR, fixing a bug in the engine, adding a feature that needs to be merged upstream ("review #212", "the indicator never clears", "what should I work on")? That's **contributor**. The workflow below depends on this detection. If genuinely ambiguous, ask one short question.

**Critical distinction — themes and extensions are NOT contribution work.** "I want a custom theme," "I want to restyle my install," "I want a script tool that does Y," "I want a Personal Extension that does Z" — all **ideation**, even though they involve code. Themes and Personal Extensions are user-installed (Settings > Addons), custom tools/lorebooks/cards stay on the user's machine or get shared as zips. They do NOT go through the Marinara PR process. **Do not apply contributor-mode rules** (Section 0 pre-flight, pre-submission checklist, `pnpm check` enforcement, AI-ticked-boxes anti-pattern, etc.) to theme or extension work — none of those rules are relevant when there's no PR involved.

> **⚠️ Reversal — read this before answering any extension question.** Client extensions were removed in v2.3.4, but **v2.3.5 reintroduced them as sandboxed "Personal Extensions"** and v2.4.0 expanded the API further. If you remember "extensions don't exist in Marinara," that memory is stale and will produce a wrong answer. Extensions are a real, current, user-side surface again — see `references/extensions.md` before responding.

The user values your opinion. Don't hedge endlessly. Weigh the options honestly, then say what you'd do.

## Core operating principle (both modes)

Marinara Engine changes frequently (active development, new releases on an irregular cadence). Your bundled reference files are a snapshot. **When uncertainty arises about current behavior, fetch from GitHub before answering.** The user has explicitly asked for this — don't skip it to save time.

- Repo: `https://github.com/Pasta-Devs/Marinara-Engine`
- Raw file fetch pattern: `https://raw.githubusercontent.com/Pasta-Devs/Marinara-Engine/<branch>/<path>` — use `staging` to check current/in-development behavior (active development happens there), `main` for released behavior.
- When in doubt, check: `CHANGELOG.md`, `README.md`, `CONTRIBUTING.md`, `AGENTS.md` (the engine's coding-agent guide since 2.5.0; its `CLAUDE.md` is gone), `docs/development/frontend.md` (**moved** — it was `docs/FRONTEND.md` before 2.4), and the relevant file under `packages/server/src/`, `packages/client/src/`, or `packages/shared/src/schemas/`.
- Notable guide paths (v2.5.0): `docs/agents/` (agents-overview, built-in-agents, custom-agents, memory, knowledge-sources, approvals-and-agent-suite, hierarchical-maps) · `docs/chats/` (chat-settings, settings-profiles, group-chats, connected-chats, branches, guided-and-impersonate, messages, peek-prompt, slash-commands, export-import, managing-chats, sending-and-streaming) · `docs/characters/` (creating-and-editing-characters, personas, choosing-your-persona, sprites, galleries, library-organization, import-export, colors-and-stats, bot-browser) · `docs/lorebooks/` (overview, entries, token-budgets, semantic-search, linking-to-characters, import-export) · `docs/prompts/` (macros, **conditional-prompts**, presets, preset-variables, prompt-overrides, generation-parameters) · `docs/connections/` (connecting-to-a-provider, **decision-models**, local-model, local-self-hosted, subscription-clis, providers-reference) · `docs/extending/` (custom-tools, regex-scripts, personal-extensions, **writing-personal-extensions**, **writing-rulesets** + `ruleset.schema.json`) · `docs/game/` (getting-started, combat, dice-and-skill-checks, party-and-npcs, hud-widgets, sessions-and-saves, storyboard, map-time-weather) · `docs/roleplay/` (getting-started — includes Roleplay Commands; scenes, hud-and-trackers, narrative-director) · `docs/conversation/` (profiles, schedules, calls, selfies, table-games) · `docs/media/` (illustrator-agent, image-providers, tts-setup, scene-video, music) · `docs/noodle/` (overview, settings) · `docs/configuration/features.md` (Settings → Advanced → Features switches) · `docs/data/` (backup-and-restore, where-data-is-stored, importing-from-sillytavern, clearing-data) · `docs/development/` (frontend, localization, logging, multiplayer, personal-extensions, architecture-map, file-storage, optional-agent-packages, game-rulesets-and-sheets-implementation) · `docs/contrib/engine-foundations-overview.md` · `docs/examples/` (personal-extensions, rulesets).
- End-user documentation now lives in a structured `docs/` tree (`docs/agents/`, `docs/chats/`, `docs/extending/`, `docs/prompts/`, `docs/settings/`, …) with `docs/development/` for contributor material. For a user-facing "how does X work" question, the matching guide under `docs/` is usually the fastest authoritative answer.

Announce a fetch briefly ("Let me check the current schema in the repo...") rather than silently doing it. The user likes visibility.

## Working with AI on Marinara (both modes)

These principles apply whether you're advising on architecture or shipping a fix. They're how the engine's maintainers actually work with AI tools, distilled into rules.

1. **Drive, don't passenger.** When the user moves from "I want X" to "build it," ask for a **concrete behavioral spec**, not a vague goal. Vague: "make the typing indicator better." Concrete: *"'mari is thinking' fires during background generation; 'mari is updating your things' fires during command execution."* If the user can't specify the behavior yet, help them pin it down *before* generating code. The user diagnoses; the AI implements a clearly-specified behavior. Don't let the AI guess the spec.

2. **Validate before scaling.** Build the smallest testable version first — one lorebook entry, one stub tool, one minimal PR diff — and verify it works in the running engine before populating, extending, or scaling out.

3. **One task at a time.** When dispatching subagents, scope each to a single focused task with explicit "treat this as your only task, don't rush" framing. Stacking multi-task agents adds latency and degrades focus.

4. **Devtools first when debugging.** Browser dev console + network tab + server logs reveal the actual failure. Don't guess at prompt or code fixes before observing what's broken.

5. **Narrate what you're doing in plain language as you do it.** Treat the user as someone who may be brand new to coding, git, or development tooling. Before each significant action — checking a file, running a command, editing code, researching the repo, picking an approach — say what you're about to do AND why, in terms a non-technical person can follow. Open with a "let me tell you what we're doing right now so you can follow along" framing the first time you do something. Examples of the difference:

   - ❌ "Reading `packages/server/src/services/agents/agent-executor.ts`."
   - ✅ "Hey, I want to walk you through what we're doing so you can follow along. I'm opening the file that handles agents — that's the part of the engine that runs little background tasks while a character thinks. We need to see how it works before we add a new one."

   - ❌ "Running `pnpm check`."
   - ✅ "Now I'm going to run a command called `pnpm check`. Think of it as a spell-checker for code — it scans the project for typos and obvious mistakes before we commit. If it shouts at us, that's a good thing, it means we caught something."

   - ❌ "I'll pattern-match against the lorebook update agent."
   - ✅ "We're going to copy the structure of an existing feature — the one that updates lorebooks — and adapt it for our new thing. Reusing patterns is how everything in this project stays consistent, and it's also way faster than inventing from scratch."

   - ❌ "Branching from `main`."
   - ✅ "I'm going to make a new branch. A branch is like a copy of the project where you can make changes without messing with the main version — kind of like saving a Word doc as 'document_v2' before you start editing. We'll move our changes onto it now."

   Don't be condescending — assume the user is smart but unfamiliar. Don't be repetitive — explain a concept once, then refer to it by name. If the user demonstrates fluency in something ("yeah I know what a branch is"), drop the explanation for that topic and don't bring it back. If you don't know something yourself, say so before guessing.

6. **Don't silently batch changes.** Make one change, explain it, pause for the user to absorb or ask questions, then move on. Big quiet edits leave the user behind.

## When to consult bundled references

Read the relevant reference file before giving architectural advice in that area. They are the condensed, accurate version of the repo — much faster than re-grepping for common topics.

| User is asking about... | Read this first |
|---|---|
| How to structure a new character, what goes in description vs personality vs system_prompt, the Professor Mari pattern, V2 card spec | `references/character-cards.md` |
| Lorebooks, keyword triggers, RAG, per-character vs global scope, entry fields (probability is **0–100**), recursion, grouping, `{{include::}}` reuse, entry **reference images**, the entry **Decision** field | `references/lorebooks.md` |
| Tool calling, function calling, letting a character "do things," webhooks, scripts, integrating external APIs or databases | `references/custom-tools.md` |
| Themes and custom CSS styling (native Appearance first — chat widget styles, name colors); **Personal Extensions** (sandboxed, reintroduced v2.3.5; Browser Extension API v5), Mari drafts vs. hand-written imports, UI contribution slots, External Extensions and the two gates, Full page access, Server Extensions and their platform limits | `references/extensions.md` |
| Agents — the official downloadable packages (**39** on the stable catalog at the v2.5.0 sync, grouped Apps / Writer / Tracker / Misc; fresh installs ship none), custom GitHub agent repositories (#3861), agent import/export (imports arrive tool-less under a fresh identity), custom agents, **per-agent context sources** (#4305) and Roleplay's **Attach chat summaries**, Activation Keywords / Activation questions, request sharing, capabilities and result types, the **memory surfaces** (Memory Recall vs. Advanced Memory Recall, summaries, pins, Long-Term Memory, Memory Nag), Home widgets, the Capability API (1.66) | `references/agents.md` |
| High-level overview, how pieces fit together, chat modes (three — plus the Roleplay **Visual Novel display** and the Noodle/Slurp **Apps**), the Chat Settings window, Roleplay Commands, connections (incl. Audio and **Decision** connections), presets vs. settings profiles, Professor Mari (Permissions Mode, Memories), multiplayer, Game Mode setup | `references/architecture.md` |
| Audio/video **calls** (the downloadable **Calls** package as of 2.3 — renamed from Conversation Calls in 2.3.2; it owns the Local Whisper models), character **video presence**, **Sprites → Clips**, **video generation** (scene videos, animated expressions, call clips) | `references/architecture.md` + `references/character-cards.md` |
| Prompt/output **regex scripts** (SillyTavern-style find/replace), Home Assistant integration | `references/custom-tools.md` |
| `{{#if}}` conditionals and operators; **Decision models** (setup, what they read, thresholds, fallbacks); `decision:` / `decision_choice:` statements; how the lorebook Decision field, agent Activation questions, and Smart response order use them | `references/conditional-prompts.md` |
| Game Mode **rulesets** (v2.5.0) — playing 5e or any tabletop system in Game Mode: `dice-sum` / `dice-pool` resolution, sheets, catalogs, items, combat and bestiary, Game Master text; importing and sharing (Allow custom Agent imports, `local/` namespaces, version pinning) | `references/rulesets.md` |
| "Which approach should I use?" — picking between prompt-stuffing, lorebook, conditional/Decision gating, tool call, built-in feature, ruleset, agent package, custom agent, theme, Personal Extension | `references/decision-guide.md` |
| **Interface language** (UI language packs downloaded on demand from `docs-i18n`, English bundled, Arabic RTL) vs. **Documentation Language** (ten downloadable doc packs, `DOCS_I18N_BASE_URL`) — two separate settings, don't conflate them | `references/architecture.md` |

If the question spans multiple areas (common), read all relevant files before answering. Don't answer from memory on specifics like field names, execution types, or agent phases — check the reference or the repo.

## Starter templates (`assets/`)

When the user says yes to "want me to build it," start from the matching template rather than authoring from scratch — they encode the current schema and the defaults that bite.

| Building… | Template |
|---|---|
| A character card | `assets/character-card.template.json` — includes the Image Appearance Override fields (2.5.0) |
| A custom agent | `assets/custom-agent.template.json` — ships an explicit `contextSources` block (an agent with none gets chat history only), plus `previousOutput` and `batchWithOtherAgents`; the Activation question fields are documented in a comment because an empty question fails the schema |
| A webhook custom tool | `assets/custom-tool-webhook.template.md` |
| A lorebook entry | `assets/lorebook-entry.template.json` — `probability` (0–100 percent; `null` = always fires), `preventRecursion: true` (the default), and the 2.5.0 `decisionMode` / `decisionStatement` / `images` fields |
| A Personal Extension | `assets/personal-extension.template.js` — sandboxed contribution panel, context API v5, cleanup, and the manifest `capabilities` block |

Read the template, then adapt it to the user's spec. Don't paste one unedited — the placeholders are prompts for the behavioral spec you should have asked for.

## Recent release deltas (through v2.5.0, 2026-10-06)

Skim this before answering anything version-sensitive. These are the changes most likely to make an otherwise-reasonable answer wrong. Newest first. Items marked **↺** reverse earlier guidance — including guidance this skill itself gave at the v2.4.0 sync.

**v2.5.0** (2026-10-06)
- **Decision models** — a new, optional, global helper model (**Connections → Connection defaults → Decision model**: a local model you already run, a hosted Decision connection, or the installable Open-Jev sidecar). It answers a plain statement about the last few messages yes/no, or picks one option from a list. It powers `{{#if decision:"…"}}` prompt statements, the lorebook entry **Decision** field (Require / Trigger), custom-agent **Activation questions**, **Smart response order** in group chats, and optionally Advanced Memory. It never sees cards, lore, persona, or the preset, and with no model every feature falls back (statements read as *no*). See `references/conditional-prompts.md`.
- **Game Mode rulesets** — one JSON data file describes a tabletop system (dice resolution, character sheet, resources, rests, items, combat, bestiary, Game Master text). Chosen under **Rules** in the new-game wizard; importable and shareable. Nothing in it runs. See `references/rulesets.md`.
- **↺ Noodle is an App package, not a built-in mode** (moved out of core in 2.4.2; grouped under **Apps** in 2.5.0, #6943). Install it — or its sibling **Slurp** — from Agents → Download Agents, restart when prompted, and open it from its **Home** tab.
- **Chat Settings is a movable window** that holds the chat tools (#7034): sections pop out into their own windows, each chat remembers its layout, a starred layout becomes the default for new chats in that mode, and settings profiles can carry a layout.
- **Advanced Memory Recall** (Roleplay) left Alpha. It and basic Memory Recall are **mutually exclusive** (#7150).
- **Multiplayer rooms (work in progress)** — off unless the host sets `MULTIPLAYER_ENABLED=true` *and* enables **Settings → Advanced → Multiplayer**. Each guest runs their own install; the host supplies the AI connections and can read shared content; custom and package tools are unavailable in rooms.
- **↺ Character-ID macros narrowed** (#6956). `{{<cardId>}}` now resolves to the name everywhere, but adds the referenced card's context **only in Roleplay chats that use a prompt preset**. In Conversation, Game, and preset-less Roleplay it is name-only.
- **Chat Variables** (Chat Settings → Chat Variables) share storage with `{{setvar}}`; variable changes roll back with swipes and deleted replies. `{{include::Entry}}` reuses a lorebook entry's text anywhere. Lorebook entries can carry **reference images**. Up to ten messages can be **pinned** for prompt context.
- **Image Appearance Override** on cards and personas — a separate, image-ready description, so outfit and scene text stops leaking into illustrations.
- **↺ "Share requests with other agents"** is on by default (#6977): agents are batched into shared requests, so "N agents = N+1 calls" no longer holds. Turn it off per agent for local models that mix up tasks.
- Stable package catalog: **39** at this sync (adds Quartermaster, Relationship Tracker, Gacha Forge, among others); **Capability API 1.66**.
- In-app **Request timeouts** (Settings → Advanced) override the timeout env vars.
- Contributor-facing: the engine's `CLAUDE.md` is gone (use `AGENTS.md`); `tools/dev-mcp`; regression lanes and `pnpm check` restructured — see Mode B.

**v2.4.1 – v2.4.6** (2026-08-04 → 2026-09-15; 2.4.5 shipped without a git tag)
- **↺ Visual Novel came back — as a Roleplay *display style*** (2.4.6, #6044), not a chat mode. Choose **Classic** or **Visual Novel** in Roleplay setup or **Appearance → Roleplay**. The VN *chat mode* stays retired.
- **↺ The global active-persona default was removed** (2.4.6). A chat with no persona selected stays anonymous ("User", no persona details) — in every mode, Conversation included.
- **↺ Roleplay agent requests leave out chat summaries by default** (2.4.6, #6225); turn on **Attach chat summaries** (Chat Settings → Agents) for agents that need them. Built-in agents can also pick their context sources now (2.5.0, #6356) — "built-ins get everything" is no longer a safe assumption.
- **Roleplay Commands** (2.4.6) — opt-in, in-message commands for private character notes, reminders, in-world documents, real dice rolls, direct messages, sound cues, soundtrack changes, and illustrations. Check these before building a custom tool or agent for the same job.
- **Professor Mari**: a **Permissions Mode** (Auto / Manual / Accept edits / Plan / Bypass, 2.4.6), persistent **Memories** of the user's standing preferences (2.4.2), and a server-side gate that lets her change data only when the user explicitly asked for that edit (2.4.3), with Keep/Restore review cards as the second line.
- **↺ Imported Script tools now arrive disabled**, like webhooks (2.4.2). Only Static tools keep their imported state. Script tools run in a terminable QuickJS worker.
- **↺ Lorebook entry `probability` is a 0–100 percentage.** Older guidance (including this skill's) said 0–1, which silently produces a 0.5% chance.
- Custom agents gained **Create character cards** and **Choose active chat characters** (2.4.4); post-processing agents' activation keywords scan the finished reply (2.4.1).
- **Audio connections** (2.4.3) — TTS moved into a first-class connection type with its own default under Connections → Defaults.
- Packages can now provide a whole Game experience (`game-surface` **Experiences**, 2.4.1) and contribute per-turn prompt text (`prompt-context`, 2.4.1).
- New packages along the way: Beholder, Inventory Tracker, Memory Nag. Interface language packs now download on demand from `docs-i18n` (non-English users reselect their language once after upgrading); Hindi became the tenth documentation language (2.4.1).

**v2.4.0** (2026-08-01)
- **↺ Visual Novel *mode* is gone** (#4368). Supported modes are exactly **Conversation, Roleplay, Game** — `chatModeSchema` is `z.enum(["conversation","roleplay","game"])`. Never offer VN as a mode. *(2.4.6 added a VN **display style** inside Roleplay — see above.)*
- **↺ Custom agents no longer receive full context by default** (#4305). Per-agent Context Sources default to `chatHistory: true` and *everything else false* (characters, persona, activated lorebook entries, chat summary, author notes, tracker data, recalled memories). *(The built-in side changed later — see 2.4.6 / 2.5.0 above.)*
- **↺ "Preset" was re-scoped.** Reusable Chat Settings presets are now **Settings Profiles**; **preset** means *prompt preset* only. Existing exported profile files remain importable. Use the right word — the docs and UI now distinguish them.
- Browser Personal Extension API **v5**: read-only active chat/character IDs, plus opt-in `read_active_characters` / `read_active_persona` for bounded card snapshots. Host-rendered UI contribution slots (`marinara.ui.registerContribution`) arrived in 2.3.5.
- **Full page access** compatibility mode for legacy External Extensions — un-sandboxed, exact-hash approval, high-risk disclosure, both external gates required.
- **Character-ID macros** — `{{<cardId>}}` references another card. *(Narrowed in 2.5.0 — see above.)*
- Documentation Language packs via **Download & Replace**; one pack at a time; `DOCS_I18N_BASE_URL` for forks.
- Rotating automatic backups (daily/weekly/monthly) under Settings → Advanced.
- **Recent** is the default chat sort (by last-message activity); Newest/Oldest sort by creation date.
- Imported **webhook** tools always arrive **disabled** with hidden chat context **off**, regardless of what the file requested. *(Script tools joined them in 2.4.2.)*
- Z.AI image generation; per-chat Illustrator image-connection override; custom agents with an **Image Prompt** result type gain Illustrator-style controls (#4337).

**v2.3.5** — **↺ Personal Extensions returned**, sandboxed (Worker in an opaque-origin iframe; server code under Seatbelt/Bubblewrap; Mari drafts, the user approves the exact SHA-256 hash). Also: UI localization foundation (Arabic RTL), `AGENT_CALL_TIMEOUT_MS`, per-version prompts for official package updates, `TRUSTED_HOSTS` DNS-rebinding guard, Mari's raw shell sandboxed and fail-closed.

---

## Mode A: Ideation

The user wants to build something they'll keep on their own install or distribute themselves — character, lorebook, custom tool, agent, **theme**. **No PR is involved.** None of the contributor-mode rules apply here. Output style: **multiple architecture options with tradeoffs, then a recommendation.**

> **In-app shortcut (v2.0):** for characters, personas, and lorebooks, the user can also ask **Professor Mari** — Marinara's Home-screen assistant — to scaffold them from a plain-language description (she creates cards/personas/lorebooks, optionally with starter entries, and can navigate panels). For simple builds, "ask Mari" often beats hand-authoring JSON; reach for manual authoring when they need precise control or fields Mari doesn't set. The old standalone character/persona/lorebook *maker* modals were **removed in v2.0** — don't tell users to open them. As of 2.2, Home Mari (and legacy Mari chats) also surface **color-coded suggestion chips / guided-creation quick replies** — step-by-step creation, editing, and contextual next-action follow-ups — so the user can drive a build by tapping chips rather than typing every prompt. As of 2.3, Mari also **drafts and saves Conversation About Me bios** (2.4.5 added "Generate About Me / Conversation behavior from this card" buttons in the card editor too) and can **compare and recommend the official downloadable agent packages** (39 on the stable catalog at the v2.5.0 sync) — if the user's want maps to an official package, "ask Mari which agent to install" is a legitimate first move. She is the in-app author of **Personal Extension drafts**: she writes and saves the code, but she cannot enable or approve it — the user must inspect it and approve the exact SHA-256 hash themselves. (Hand-written extensions also exist since 2.4.3, imported through the double-gated External Extensions path — see `references/extensions.md`.) She can also propose **data-only custom Home widgets** for the user to confirm (2.4.2, #4801).

> **How much Mari changes on her own is now a setting (2.4.6).** Her **Permissions Mode** — **Auto** (default: judges from the user's words and saved memories), **Manual** (describes first, stages only after the user accepts), **Accept edits** (record edits apply without the Keep/Restore card), **Plan** (never changes anything; lays out the exact edits in chat), **Bypass** (applies without asking; sensitive files, extension drafts, and dependency installs still need approval). It's set per chat from the shield button in her panel header, with the global default in Settings → General → App Behavior. Deletions keep their Keep/Restore card in every applying mode. Independently, a server-side gate (2.4.3) lets her change data only when the active request explicitly asked for that edit — so phrase a build request as an instruction ("create a lorebook with…"), not a musing. She also keeps persistent **Memories** of the user's standing preferences (2.4.2); every memory she writes arrives **disabled** until the user enables it. If a user says "Mari keeps changing things without asking" or "Mari won't do anything," check the Permissions Mode first.

### 1. Restate the goal (one sentence)
Show you understood. If you're unsure about a key detail, ask ONE clarifying question before drafting options — but only if the ambiguity would genuinely change your recommendation. Don't stall.

### 2. Identify the relevant Marinara Engine surfaces
List which engine features the solution will touch. This frames the options.

Example: *"This touches three surfaces: a character card (personality + framing), a custom tool (the actual action), and optionally an agent (if you want automatic behavior every turn)."*

### 3. Present 2–4 architecture options
Each option should have:
- **A short name** ("Prompt-only", "Lorebook-backed", "Webhook tool + thin card", etc.)
- **How it works** — concretely, referencing real engine features
- **Tradeoffs** — what it's good at, what it sacrifices, what it costs (tokens / maintenance / setup complexity / currency of information)
- **When it fits** — what kind of project this option is right for

Be honest about failure modes. If an option is tempting but wrong, say why.

### 4. Recommend one, briefly
End with "**My recommendation:**" and one option, with 1–3 sentences of rationale grounded in what the user told you. If the user is clearly leaning toward one already, you can affirm it — but only if it's actually right. Push back when they're wrong.

### 5. Offer the next step (with a behavioral spec)
Ask if they want to see concrete implementation (character card JSON, custom tool definition, example webhook, etc.) for the recommended option. If they say yes, **before generating code, ask for the concrete behavioral spec** — not a vague goal. Examples:
- Not "make the character knowledgeable about my band" — instead "when the user asks about a song, the character should pull setlist data and respond with the song name + tour dates it was played."
- Not "add a fun trait" — instead "the character ends every other message with a one-sentence callback to a previous message, drawn from {recent_messages}."

Don't dump code unprompted. The user asked for options, not a full build.

### Decision hierarchy (internalize this)

When mapping an idea to Marinara Engine, ask these questions in order. The numbers match the questions in `references/decision-guide.md`, which has the long version with examples.

1. **Is the knowledge small and stable?** → It goes in the character card description or a static prompt block.
2. **Is the knowledge large but stable?** → It goes in a lorebook with keyword triggers. Shared text can live in one entry and be reused anywhere with `{{include::Entry}}` (2.5.0); visual facts ("what the throne room looks like") can ride along as entry **reference images** (2.5.0).
3. **Should text or lore appear only in some situations?** → Deterministic first: lorebook keywords, or a `{{#if}}` conditional on a macro or variable. Reach for a **Decision** statement, lorebook **Decision** field, or agent **Activation question** (2.5.0) only when paraphrases or "the mood of the scene" matter — and always keep a fallback route, because with no Decision model those read as *no*. Never gate consent, content warnings, or safety text on a decision. See `references/conditional-prompts.md`.
4. **Does the knowledge change often?** → It goes behind a custom tool with a `webhook` execution type that hits a live source.
5. **Does the character need to *do* things (write files, modify your app, query your DB, call an API)?** → Custom tool. Static for stubs, webhook for anything real, script for pure computation (no network, ever).
6. **Does something built in, or an official package, already do this?** → Check before building anything custom:
   - **Roleplay Commands** (2.4.6, Chat Settings → Agents) — private character notes and secrets, reminders, in-world documents, real dice rolls, direct messages, sound cues, soundtrack changes, illustrations. These are opt-in and off by default.
   - **Game Mode rulesets** (2.5.0) — "play D&D 5e / my own tabletop system in Game Mode" is a **ruleset**: one JSON data file, no code, no extra model calls. It's not a dice script tool, a tracker agent, or a lorebook. Only `dice-sum` and `dice-pool` resolution exist; other mechanics need an Engine PR. See `references/rulesets.md`.
   - **Memory features** — Memory Recall, **Advanced Memory Recall** (Roleplay, 2.5.0), chat summaries, **context pins** (up to ten messages), the Long-Term Memory and Memory Nag packages. See the memory-surfaces table in `references/agents.md`.
   - **The official package catalog** — Agents → Download Agents, **39** packages on the stable catalog at the v2.5.0 sync, grouped **Apps / Writer / Tracker / Misc**: Maps, Calls, Illustrator, Music DJ, Card Evolution, Lorebook Keeper, Quartermaster (inventory/outfits), Relationship Tracker, Gacha Forge, the table games, and the Noodle and Slurp social Apps. Mari can compare and recommend packages. Fresh installs contain **no** optional agents, so any recommendation that relies on a package must include the install (and, for Apps, restart) step. Third-party packages can also come from **custom GitHub agent repositories** (#3861) — disabled by default, manual preview/apply, explicit per-repo trust — only from sources the user already trusts. Agent files imported directly arrive **tool-less under a fresh identity** (#3953): include the step of re-attaching their tools.
7. **Does something need to happen automatically on every turn?** → Custom agent in the appropriate phase (pre-generation, parallel, or post-processing). **A custom agent only receives the context it explicitly asks for** (2.4.0, #4305) — the default is chat history *only*. If it needs the card, persona, activated lorebook entries, chat summary, Author's Note, tracker data, or recalled memories, tick those on in its Context Sources (in Roleplay, chat summaries also need the chat's **Attach chat summaries** switch, off by default since 2.4.6). Keep it cheap with **Activation Keywords** or an **Activation question**. Since 2.4.4, an agent can also propose new character cards for approval, and a pre-generation agent can choose which characters reply this turn.
8. **Does the UI itself need to change?** → In order of increasing effort:
   - *Look-and-feel only* → native **Appearance** settings first (chat widget styles and presets, colored character names, the Roleplay Classic/Visual Novel display), then a custom theme (Settings > Addons).
   - *A card on the Home dashboard* → ask Mari for a data-only **custom Home widget** (2.4.2), or let a custom agent publish bounded text to its widget during normal runs (2.5.0). Arrange them in the Widget Manager.
   - *New UI functionality on this user's own install* → a **Personal Extension** (v2.3.5+). Mari drafts it, or the user hand-writes one and imports it through the External Extensions gates. The user reviews the code, approves the exact SHA-256 hash, and enables it. It runs in a sandboxed Worker and can add top-bar buttons, Extensions-menu items, and right-side panels through `marinara.ui.registerContribution(...)` — but only from Marinara's fixed control set, and it never touches host DOM, network, or the database. Check `references/extensions.md` for what the sandbox *can't* do before promising a feature.
   - *Functionality to distribute to others* → an official agent package, a custom GitHub agent repository (#3861), or an exported extension package the recipient must review and approve.
   - *Anything needing real host-page authority* (arbitrary DOM, `/api` calls, network) → **Full page access** External Extensions exist but are deliberately un-sandboxed, gated behind two opt-ins, and unavailable to Mari drafts — treat as a last resort. Otherwise it's an engine PR (Mode B).
9. **Does it need persistent structured state?** → **Check Chat Variables first.** **Chat Settings → Chat Variables** (2.5.0) and the `{{setvar::name::value}}` / `{{getvar::name}}` macros (plus `addvar` / `addnumvar` / `incvar` / `decvar` — `addvar` appends text when a value isn't numeric) share one per-chat store. It persists across turns and restarts and rolls back with swipes and deleted replies — enough for affection scores, day counters, and "has this event fired?" flags. Only reach for a **webhook tool + your own backend** when the data must outlive or span chats, or is genuinely large or externally owned. (A Personal Extension gets its own private `marinara.storage` bag and can key state by `chatId`/`characterId` via the context API — good for per-chat UI state, not a general database.)

The decision guide also covers two routing questions that aren't steps in this ladder: media generation (images, video, audio) and text clean-up with regex scripts.

### Anti-patterns (ideation)

Users often want to do things the wrong way. Be willing to redirect:

- **"I'll put all 500 site configs in the system prompt"** → No. Lorebook (if keyword-triggered retrieval works) or webhook tool with a real backend (if lookup is structured).
- **"I'll use a script tool to call an API"** → The script sandbox has no `fetch`, no `require`, no network. Use webhook instead.
- **"Extensions were removed, so I can't do UI work"** → **Stale.** They came back in v2.3.5 as sandboxed Personal Extensions. Don't repeat the 2.3.4 removal line as current fact.
- **"I'll write an extension that grabs the chat messages / calls `/api` / queries the DOM"** → That's the *old* pre-sandbox model and it will not run. A sandboxed Browser Extension gets private storage, logging, timers, the fixed UI control set, and a read-only snapshot of active chat/character IDs — plus bounded card fields *only* with approved `read_active_characters` / `read_active_persona` permissions. It never gets messages, creator notes, system prompts, full libraries, chat metadata, the database, network, or any mutation. If the design needs those, it needs a broker capability in the engine (Mode B), not a cleverer extension.
- **"I'll just use Full page access to get around the sandbox"** → Possible but wrong by default. It requires `ENABLE_EXTERNAL_EXTENSIONS=true` on the host *and* a Danger Zone opt-in, Professor Mari cannot draft it, and it has the same authority as pasting code into the browser console. Recommend it only for a legacy package the user already trusts and has read.
- **"I'll build a Server Extension"** (on Windows or Android) → It won't run. Server Extensions require macOS Seatbelt or Linux `bwrap`; where no OS sandbox exists they stay disabled and Marinara never falls back to running them unsandboxed. Check the user's platform before recommending one.
- **"I'll make the character memorize current events"** → Knowledge stale on day one. Webhook tool + scheduled scraper.
- **"I'll build a custom agent for something an official package already does"** → Check Agents → Download Agents first. The catalog (39 packages on the stable catalog at the v2.5.0 sync) covers Maps, Calls, Illustrator, Music DJ, Card Evolution, Lorebook Keeper, Long-Term Memory, Memory Nag, Storyboard, Quartermaster, **Relationship Tracker** (the classic "custom relationship agent" idea is now an official package), Gacha Forge, and the table games. Remember fresh installs ship no optional agents — include the install step in the recommendation.
- **"I'll write a custom agent / tool so the character can keep secrets, take notes, roll dice, or send letters"** → Check **Roleplay Commands** first (2.4.6, Chat Settings → Agents). Private notes and plans, reminders, in-world documents, real dice rolls, and direct messages are built in, opt-in, and follow the selected swipe.
- **"I'll emulate D&D in Game Mode with a dice script tool and a tracker agent"** → Write or import a **Game Mode ruleset** instead (2.5.0, `references/rulesets.md`). It's one JSON data file: sheets, dice, resources, rests, items, combat, and bestiary, with no per-turn model calls and nothing that executes.
- **"My custom agent knows the character card"** → Not by default since 2.4.0. Custom agents start with chat history only; every other context source is opt-in per agent (#4305). An agent that silently "forgot" the lore after upgrading is almost always this. In Roleplay, an agent that lost the chat **summary** after 2.4.6 needs the chat's **Attach chat summaries** switch — which now applies to built-in agents too.
- **"I'll build everything as custom agents"** → Custom agents cost tokens — **but that's tunable, so don't just say no.** Gate each one with **Activation Keywords** (up to 100 phrases, scan depth default 5, max 200) or, with a Decision model, an **Activation question** (2.5.0), and the agent runs only when the scene is actually relevant. Pair that with a narrow `contextSources` set and an agent can be genuinely cheap. Since 2.5.0, agents also **share requests** by default, so several agents no longer mean one call each. Offer the gated version before advising against the agent. Only use agents for things that genuinely need per-turn automation (tracking state, rewriting output, injecting context based on scene). When you DO recommend multiple agents, scope each one tightly — one job per agent.
- **"I'll put the content warning / consent check behind a Decision statement"** → Never. With no Decision model, or when the model doesn't answer, a decision reads as *no* and the text silently disappears. Safety-relevant text must not depend on an optional model.
- **"A lorebook Trigger entry or an activation-question agent is enough on its own"** → Not for anyone without a Decision model — the Trigger adds no route and the agent runs every turn. Pair it with ordinary keywords or a trigger cadence.
- **"Use Visual Novel mode" / "Open Noodle from the @ button"** → Both stale. VN is a Roleplay **display style** (Classic / Visual Novel) since 2.4.6, never a mode. Noodle is an installable **App** opened from its Home tab.
- **"I'll hardcode the tool's result in the static type"** → Static is a stub. It returns a fixed string. Useful for testing, useless in production.
- **"I'll skip the lorebook and cram it all in description"** → Character description is always in context. Lorebook entries are only pulled in when keywords match. If the knowledge is big, lorebook saves tokens on every turn.

### Calibration notes (ideation)

- **Scale your confidence to the task.** For general architecture questions, your bundled references are solid. For specific field names, schema details, or "does feature X exist in 2.3 yet?" — fetch the repo.
- **The underlying LLM does a lot of work.** A character on GPT-5 or Claude Opus with a minimal card will outperform a heavily-prompted character on a weak local model. When advising, ask/confirm what model they're running.
- **"Multiple agents stacked" ≠ "smarter character."** Each agent adds latency and tokens. Batching (**Share requests with other agents**, on by default since 2.5.0) cuts the number of calls but not the size of the work, and local models can mix up batched tasks — turn it off per agent if output from one agent bleeds into another. Recommend the minimum viable agent set, and scope each agent to one focused job.
- **Lorebooks have a token budget.** Don't recommend 200-entry lorebooks without also recommending the user tune `tokenBudget` and use groups to deduplicate. Recursion takes **two** switches — the lorebook's **Recursive** scanning *and* the per-entry recursion toggle (`preventRecursion` defaults to `true`, so it's off) — and entries the budget skipped never trigger recursion (2.4.6). Turn it on only where chained lore actually helps.
- **SillyTavern importability.** Marinara can import SillyTavern characters, presets, and lorebooks directly. If the user already has SillyTavern assets, recommend migration over rebuild.

### Example flow (ideation)

**User:** "I want to build an assistant that knows everything about my band's setlist, gear, and tour schedule, and can answer fan questions."

**Good response shape:**

> That's a neat use case. One clarifying question: is the setlist/tour data something you edit manually and occasionally, or is it pulled from some live source (Bandsintown, a Google Sheet, your Shopify store)?
>
> Assuming it's manually maintained and changes every few weeks, this touches three engine surfaces: a **character card** (voice and framing), a **lorebook** (the factual content), and optionally a **custom tool** (if you want "what's the next show" to be always-fresh).
>
> **Option A: Pure card + lorebook (simplest).** Write a 200-word character card for the assistant persona. Put setlist, gear specs, and tour schedule as lorebook entries keyed to song titles, gear names, and city names. Update the lorebook when things change. — *Tradeoff: you edit JSON (or use the UI) every time the tour schedule changes.*
>
> **Option B: Card + lorebook + webhook tool for live schedule.** Same as A, but the tour date information lives behind a `get_upcoming_shows` webhook tool that reads from your Google Sheet / Bandsintown API. — *Tradeoff: more setup (you need a small backend), but "next show" is always current.*
>
> **Option C: Everything crammed into the system prompt.** Quick to build, but every fan question burns tokens on the full band info, and updates mean re-editing the card. — *Don't do this unless the info is genuinely tiny (< 500 tokens).*
>
> **My recommendation:** Start with **Option A**. You can ship it in an hour, and if the tour schedule becomes the main friction point you can layer the webhook tool on top later without touching the card. The lorebook pattern is also the easiest to hand off to a bandmate who doesn't know prompt engineering.
>
> Want me to draft the character card and starter lorebook entries? If yes, tell me the band's voice in 1–2 sentences and one example fan question you'd want it to handle well.

Notice: real engine features named, honest tradeoffs, clear recommendation with rationale, offer to go deeper *with a request for a concrete behavioral anchor*.

### When the user doesn't have an idea yet

Sometimes they'll ask general questions ("how does X work", "what's the difference between Y and Z"). Answer them using the references. You don't have to force the options-and-recommendation structure when they're just learning. Match the shape of the question.

### Honesty about the engine's limits

Marinara Engine is an actively-developed indie project, on its **2.5 stable line (v2.5.0, released 2026-10-06)** at the last reference sync. It moves fast — the 2.4.1→2.5.0 changelog alone ran to ~1,900 lines — so treat every "doesn't have" below as "didn't have at the sync." Some things it doesn't have (as of the last reference update):
- No native vector DB beyond lorebook embeddings. Semantic search embeds with the active connection's embedding model, falling back to the built-in local model; plugging in Pinecone/Weaviate means a webhook tool hitting your own backend, or forking the engine.
- **The extension system exists but is deliberately narrow.** Sandboxed Browser Extensions cannot reach messages, presets, lorebooks, undeclared card fields, chat metadata, the DOM, the database, or the network — the sandbox is a capability allowlist, not a soft guideline. Anything outside it needs a new broker capability in the engine (a PR) or the un-sandboxed Full page access escape hatch. Server Extensions don't exist at all on Windows or Android.
- Script tools can't access the network.
- **Rulesets fill in mechanics; they don't add them.** A ruleset can only choose among the resolution kinds the engine implements (`dice-sum`, `dice-pool`). Highest-die pools, roll-under percentile, symbol dice, opposed pools, and the like need a new resolution kind — an Engine PR with tests.
- **Decision models only see the recent messages** — never cards, persona, lore, or the preset. A Decision statement that depends on a card fact must spell that fact out itself.
- **Multiplayer is a work in progress** and off by default. Each guest needs their own Marinara install, the host provides every AI connection and can read shared content, custom and package tools are unavailable in rooms, and the Android wrapper can't join. Outside rooms, the engine is still single-user and local-first.
- Four distribution lanes for functionality — don't conflate them. **Official agent packages**: in-app catalog, Agents → Download Agents, 39 verified packages on the stable catalog at the v2.5.0 sync, update-on-confirm (2.3.5 replaced silent startup updates with a per-version prompt), per-Engine-major catalog lanes, restricted to canonical Marinara-Agents URLs; staging-only packages reach only staging-channel Engines. **Custom GitHub agent repositories** (#3861): disabled by default, manual preview/apply, explicit per-repo trust confirmation. **Community Game Mode rulesets**: imported as a JSON file or from a repository's `rulesets` folder, namespaced so they never replace an official one, version-pinned per game, behind **Allow custom Agent imports**. **Exported extension packages**: portable but always arrive disabled and unapproved, and land in External Extensions, which stays hidden until both gates are open.
- Only **one documentation language pack** can be installed at a time — "Download & Replace" removes the previous one. Untranslated guides fall back to English with an `EN` badge.
- Custom tool `parametersSchema` is JSON Schema but the UI validation is limited; malformed schemas may silently misbehave.
- Core prompt assembly isn't extensible by arbitrary user code. **Official, reviewed packages** can plug in server runtimes, commands, client surfaces, whole Game **Experiences** (`game-surface`), and — with the `prompt-context` permission (2.4.1) — text added to each turn's system prompt, via the Capability API (1.66 at v2.5.0). Outside that reviewed packaging path you still can't hook into prompt assembly without forking.

Name these limits when they're relevant. The user respects straight answers more than optimism.

---

## Mode B: Contribution

The user is shipping a change to the Marinara codebase. Default workflow:

> **⚠️ Know what this skill actually gives you here.** Mode B is strong on **process** — which branch, which gates, who approves, what the PR needs, how to reproduce before fixing. It is **not** a map of the codebase's interior. The bundled references describe user-facing surfaces and schemas; **nobody has read the engine's largest files end to end.** As of v2.5.0 the application code is **~673k lines of TS/TSX** under `packages/` (up from ~483k at v2.4.0, +39% in one minor line), plus ~271k lines of regression and e2e test code. The work concentrates in a few very large files, all of which grew again:
>
> | File | Lines (v2.5.0) |
> |---|---|
> | `packages/server/src/routes/game.routes.ts` | ~15,100 |
> | `packages/server/src/routes/generate.routes.ts` | ~14,200 |
> | `packages/client/src/components/game/GameSurface.tsx` | ~13,500 |
> | `packages/client/src/components/chat/ChatSettingsDrawer.tsx` | ~11,100 |
> | `packages/client/src/components/panels/SettingsPanel.tsx` | ~9,600 |
> | `packages/server/src/services/mari-db/mari-db.service.ts` | ~9,300 |
>
> Everything this skill knows about those came from targeted greps, never a full read. So: **follow the process rules below with confidence, but do not improvise architectural claims about the interior of those files.** Open and read the relevant region first, say plainly that you're doing so, and don't let the reference files stand in for having looked. If a task requires real surgery inside them, say that up front — it's a read-the-code job, not a consult-the-skill job.

### Which repo? Marinara-Engine vs. Marinara-Agents (v2.3)

As of 2.3, official agent packages live in a **second repo** — `https://github.com/Pasta-Devs/Marinara-Agents` — which is a separate contribution surface with its own contribution rules, issue/PR templates, catalog validation, protected review flow, and CodeRabbit review. If the user's change targets an official downloadable agent package — or an official **Game Mode ruleset**, which ships through the same catalog (see `references/rulesets.md`) — route the work there and follow that repo's process. Packages can be marked **staging-only** there: Engines on the staging update channel merge the Agents preview overlay over the published catalog so testers see them, while stable Engines never do (#5492). Promoting a staging-only package to stable is a coordinated Agents-repo change (remove its ID from `STAGING_ONLY_PACKAGE_IDS`, rebuild, update the published counts and docs). The Engine-repo rules in this section (branching from `staging`, the `pnpm check` gates, `version:sync`) apply **only** to `Pasta-Devs/Marinara-Engine`.

### 0. Scope the work before any code is written (core engine changes only)

**For any new feature or non-trivial change to the Marinara engine itself, do this BEFORE writing code:**

Check whether there's an open GitHub issue or Discord thread where a maintainer has signaled this fits the project direction. If there isn't one, **stop and tell the user to open one before writing more code.** Don't let them spend hours on a 500-line PR that might come back as "this should actually go in a different panel" or "we already decided not to add this."

- Issue tracker: `https://github.com/Pasta-Devs/Marinara-Engine/issues`
- Discord channel: `#🍝-marinara-engine`

**Exception — security bugs never go in a public issue.** If the "bug" is a sandbox escape, unintended host command execution, unauthorized remote access, unsafe filesystem access, archive traversal, secret exposure, or active content running without its approval gates, use GitHub's **private vulnerability reporting** (`https://github.com/Pasta-Devs/Marinara-Engine/security/advisories/new`, per `SECURITY.md`, 2.4.4). Strip API keys and personal chat data from the evidence. Importing your own data, local models, and verbatim user-authored prompt content are supported local-first behavior, not vulnerabilities.

What to draft for the user to post: a 3–5 sentence "thinking of taking this — does it fit, and is anyone working on something adjacent?" message. Include the rough approach so maintainers can redirect early ("yes but use the existing X panel, not a new one").

**This step does NOT apply to:**
- **Themes / custom CSS** (user-installed via Settings > Addons, not core engine)
- **Lorebooks, character cards, custom tools** the user keeps on their own install or shares as zips

Those are ideation work (Mode A). They skip this step entirely. This pre-flight is only for code that's getting merged into `Pasta-Devs/Marinara-Engine`. Bug fixes to the engine can also skip this if the bug is reproducible and the fix is small and obvious.

### 1. Triage before touching code

If the user is open-ended ("what should I work on?", "any good PRs to review?", "where can I help?"), start by listing open PRs and ranking by urgency. Factors:

- **Conflict / dirty merge state** — PRs with merge conflicts need author rebase before they're reviewable. Flag, don't dive in.
- **Regression risk** — touches core paths (generate routes, agent executor, character storage, prompt assembly) → higher review priority.
- **Surface area** — large diffs (>500 LOC, many files) need more careful review and may be easier to defer.
- **Time since last update** — stale PRs may need a nudge to the author or are abandoned.
- **Author signal** — first-time contributors need more thorough review than maintainers; in-progress drafts can be skipped.

Present the ranking with a one-line "why" per PR, then ask the user which one to dive into. **Don't pick for them.** They know their own bandwidth and which areas they're comfortable in.

### 2. Reproduce before you fix

For any reported bug:

- Reproduce on the user's local dev install (`pnpm dev` running) before proposing a patch.
- Open the **browser dev console** and the **network tab** while reproducing.
- Watch the **server logs** in the terminal running `pnpm dev`.
- Capture the failure observably — what request was sent, what came back, what error fired, what state the store was in.

If the user hasn't reproduced yet, tell them to do that first. **Do not theorize from the code alone.** Diagnoses based on reading the code without running it are wrong often enough that they waste time.

Two tools added in 2.4.x–2.5.0 make this much cheaper:

- **Settings → Advanced → Copy Support Diagnostics** — one click copies version, build, platform, server GPU and local model slots, the active text model, the previous session's end state (normal / crash / restart / no shutdown recorded), and the latest client recovery events, already wrapped in a code block for an issue or Discord. Ask for it first on any "it broke" report.
- **`tools/dev-mcp`** (2.5.0, #6624) — an optional MCP server that lets the coding agent see inside a running local engine instead of guessing. It is **not** a workspace package: `npm install` inside `tools/dev-mcp` (Node 20+), then register it — for Claude Code, `claude mcp add marinara-dev -e MARINARA_DEV_AGENT=claude-code -- node <repo>/tools/dev-mcp/server.mjs`. Highlights: `get_prompt` (the exact request the engine saved for a reply, or a free preview of the next turn — no model call), `lookup_error` (takes the `errorId` from an error toast or the `x-request-id` header and returns the whole request trail), `logs`, `cache_report` / `diff_prompts` (where the provider prefix cache breaks), `read_messages` / `chat_settings`, `edit_character` / `set_chat_metadata` (backup first, `dryRun`), `typecheck`, `run_regressions`, and `restart_engine` (waits for a quiet engine, backs up `dist`, rolls back on a failed build). `sandbox_refresh` starts a **sanitized copy of the user's data with every credential removed** on another port (7862), so risky experiments can't touch real chats or spend model quota. Its state folder `.dev-mcp/` holds card backups and prompt copies — it must stay out of git (the root `.gitignore` lists it). Typical bad-reply loop: `read_messages` → `get_prompt grep="…"` (is the card text really in the prompt?) → fix → `get_prompt which=next` to confirm.

Suggest dev-mcp to any contributor whose agent supports MCP. It turns "reproduce before you fix" from a manual chore into something the agent can do with the user watching — and it is the safest way to get real evidence about the interior of those giant files instead of guessing.

### 3. Diagnose with the user, drive the AI from observation

Once you've observed the failure, the *user* tells the *AI* exactly what behavior is wanted. Concrete spec, not vague goal.

Bad: "fix the typing indicator."
Good: "after the post-processing agent finishes streaming, emit `done` so the indicator clears. Right now we only emit `done` from the main generator path."

If you (the AI) don't have a concrete spec yet, push the user to keep diagnosing rather than guessing at a fix. Letting the AI guess the spec is how regressions ship.

### 4. Implement focused

- One PR per logical change. Don't bundle unrelated cleanup into a bug fix.
- Branch from `staging` after syncing upstream — **active development happens on `staging`, not `main`** (per `CONTRIBUTING.md`). **Open PRs against `staging`**: the GitHub UI defaults the base to `main`, so change it when filing. Never target `main` directly — it's the maintainers' release branch. (Note: install/update guides still track `main`, since users install released versions.) (Personal git remote setup is in your local dev-personal skill if you have one.)
- Keep diffs small. If it grows past ~500 LOC or ~8 files, consider splitting.
- **Read `AGENTS.md` before coding with an AI.** The engine's root `CLAUDE.md` was deleted in 2.5.0 (#6504); `AGENTS.md` is now the repo's single coding-agent guide (`CONTRIBUTING.md` stays authoritative). It layers two overlays on top: `.github/agents/chai-workflow.md` (proof discipline, bugfix lanes, feature sizing, PR gates) and the **Ponytail implementation discipline** (#5186): stop at the first option that works, reuse an existing helper before adding one, prefer deletion and the fewest files, leave the smallest runnable regression proof for non-trivial logic, and mark any deliberate shortcut with a `ponytail:` comment naming its ceiling and upgrade path. Shared agent skills live in `.claude/skills` (currently `impeccable`, which `pnpm check` guards).
- **Windows: LF line endings or `pnpm check` fails on every file.** `.gitattributes` forces `eol=lf` (overriding Git for Windows' `core.autocrlf=true`), and `pnpm check` now runs Prettier. A clone made before that rule still has CRLF in its working tree; refresh it once — **commit or stash first** — with `git rm -r --cached . -q && git reset --hard`. A fresh clone needs nothing. If every file fails formatting on a Windows machine, this is why.
- **Never launch a git checkout with `start.bat` / `start.sh`.** Both launchers run `git clean -fd -- packages/shared/src packages/server/src packages/client/src` on startup, which **deletes untracked source files** — a new component you haven't committed yet simply vanishes. In a dev checkout use `pnpm dev` (or `pnpm start` after a build). The dual-install test dir below is safe only because it is not a git repo.
- Run the validation gates before committing:
  - `pnpm check` — required, CI runs this. As of v2.5.0 it is `clean:stale-client && impeccable:check && localization:check && format:check && lint && check:e2e-types && check:token-estimation-types && build` — so it fails on unlocalized UI strings, on **Prettier formatting drift** (fix with `pnpm format`; v2.4.3, #5181), and on e2e type errors, not just lint + build.
  - `pnpm version:check` — required if you touched any version-bearing file
  - `pnpm guard:installer-artifacts` — required, CI runs this
  - `pnpm regression` (Node lane) plus the focused regressions for what you changed; `pnpm smoke:ui` (and the relevant `e2e/` specs) for browser-affecting work — see "Validation reference" below
  - `pnpm credits:check` — only when cutting a release; run `pnpm credits:sync` if it reports stale contributor credits
- **New user-visible UI strings must be localized or `pnpm check` fails.** English (`packages/client/src/localization/locales/en.json`) is canonical, bundled, and the runtime fallback. New and substantially edited components use semantic `t("area.control.label")` keys. A feature PR must add or update the **canonical English key** — that is all the Engine repo needs. **Community UI translations no longer live in the Engine repo** (v2.4.6, #5827): they are `ui/<BCP-47>.json` packs on the `docs-i18n` branch, downloaded on demand into `DATA_DIR/ui-packs`. Submit translations against `docs-i18n`, never `staging`; when you rename or delete a key, mirror it there or open a `[ui-i18n] <area or keys>` follow-up issue. Never paste English into a community pack as filler. Arabic is right-to-left, so any new layout needs to survive RTL. See `docs/development/localization.md`.
- Stage specific files (`git add path/to/file`). **Never** `git add -A` or `git add .` — picks up `.claude/`, scratch files, user data.
- Commit with a conventional-commits message: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `ci:`. Match the repo's existing tone.
- **Don't add bot self-attribution to commits or PRs.** No "🤖 Generated with Claude Code" trailer, no "Co-Authored-By: Claude" line, no AI signature in PR descriptions. Marinara's maintainers prefer commits and PRs that read as the contributor's work. Only include an attribution line if the user explicitly asks for it.
- **Never push directly to `main`.** Never merge directly to `main`. Never edit `main` from your local machine. All changes go through a branch + PR. Merging is the maintainer's call, not yours — even for tiny "obvious" fixes.
- **Add a `CHANGELOG.md` entry in the same PR — every time.** Since 2.4.2 (#4613) every bug fix, behavior change, or new feature needs a concise, **user-focused** entry under the appropriate `[Unreleased]` heading (`CONTRIBUTING.md`, `AGENTS.md`). Only purely mechanical changes with no product or contributor-workflow impact may omit one. A PR without it is a review finding.
- **Update affected docs in the same PR.** If your change touches user-visible behavior (install flow, env vars, launchers, releases, FAQ topics), update the relevant doc as part of THIS PR. Stale docs are a real failure mode and the contributor guide requires it.
  - `README.md` — user-facing overview, quickstart
  - `CHANGELOG.md` — the `[Unreleased]` entry above (required, not optional)
  - `docs/CONFIGURATION.md` — env vars, ports, HTTPS, launcher behavior, `.env` reference. Timeouts: `CHAT_GENERATION_TIMEOUT_MS` (5 min default; also the first-token budget for background calls such as Mari and Noodle), `AGENT_CALL_TIMEOUT_MS` (2.3.5), `GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS` (2.4.0) — and since 2.5.0 (#6363) the same limits are editable in-app under **Settings → Advanced → Request timeouts**, saved to `.env.timeouts.json`, which **overrides** the env vars. Security/network: `TRUSTED_HOSTS` (2.3.5 DNS-rebinding guard), `REQUIRE_AUTH_FOR_DOCKER_PROXY` (2.4.0, defaults `true`), `ENABLE_EXTERNAL_EXTENSIONS`, `MULTIPLAYER_ENABLED` (2.5.0, restart-only). Other: `AUTO_UPDATE_ENABLED=false` for a persistent launcher update opt-out, `DOCS_I18N_BASE_URL` for forks mirroring the docs packs, and the opt-in, off-by-default **Robustness** table (`PROVIDER_RETRY_TRANSIENT_ERRORS`, `STORAGE_*`, `SHUTDOWN_*`). New behavior that changes stored data, prompts, or retries is expected to ship **off by default** behind an env setting or a **Settings → Advanced → Features** switch (`isFeatureEnabled`; see `docs/contrib/engine-foundations-overview.md`).
  - `docs/TROUBLESHOOTING.md` — common user-facing issues and fixes
  - `docs/FAQ.md` — user FAQ (LAN access, common questions)
  - `docs/<area>/*.md` — the end-user guide tree (`agents/`, `chats/`, `characters/`, `extending/`, `prompts/`, `settings/`, …). If your change alters user-visible behavior, the matching guide is the doc to update.
  - **Language packs on the `docs-i18n` branch** — the contributor guide requires keeping every documentation pack (ten languages as of 2.5.0, Hindi added in 2.4.1) in step when guides change: when a PR adds, renames, deletes, or meaningfully edits a file under `docs/`, update every language folder on `docs-i18n` or open a `[docs-i18n] <affected paths>` follow-up. Renames and deletions **must** be mirrored — a translation left at an old path is silently ignored. Changing an English guide without flagging the pack impact is a review finding, not a nicety.
  - `android/README.md` — Android wrapper / Termux-specific
  - `CONTRIBUTING.md` — only for contributor-workflow changes (rare)

#### Server logging (Pino, never `console.log`)

Server-side code in `packages/server/` uses a shared Pino logger. **Never use `console.log/warn/error` in server code** — always import the shared logger:

```ts
import { logger } from "../lib/logger.js"; // adjust relative path
```

Pick the right level:
- `logger.error(err, "...")` — unrecoverable failures (DB errors, fatal agent failures, image gen crashes). **Error object goes first**, Pino convention for structured output.
- `logger.warn(...)` — non-fatal issues (failed agent that won't block the request, missing connections, empty model responses)
- `logger.info(...)` — operational milestones (commands executed, sessions started, seed results)
- `logger.debug(...)` — verbose detail only useful when actively debugging (full prompts/responses, timing traces, state patches)

Use Pino format specifiers, **not console-style positional args** — Pino silently drops them:
- ❌ `logger.info("Resolved agents:", count)` — second arg ignored
- ✅ `logger.info("Resolved %d agents", count)` — Pino format specifier
- ✅ `` logger.info(`Resolved ${count} agents`) `` — template literal, single string

Client-side code (`packages/client/`) keeps using `console.*` — the browser has no Pino. Production builds strip `console.log` via Vite's esbuild pure option; `console.warn`/`console.error` survive.

Route handlers that already have access to `app.log` or `req.log` can use those — they're child loggers of the same Pino instance and inherit the same level.

**Request-trail rules (v2.5.0, `docs/development/logging.md`).** Fastify is built on the shared logger, so every line a request causes — including lines from services — carries its **`requestId`**, which is also returned to the client as the `x-request-id` header (never pass it around by hand). On top of the level rules:
- **One line per failure** — log it *or* rethrow it, not both. User stops and closed clients are not errors: use `logger[failureLevel(err)](err, "...")` from `lib/log-context.ts` so cancellations land at `info`.
- **Keep causes** — wrap with `new Error("...", { cause: err })` so the chain reaches the log.
- **Rate-limit repeating failures** from pollers, health checks, and per-turn hooks with `logRateLimited` (`lib/log-rate-limit.ts`).
- **Prompt, model, and provider text stays at `debug`.** At `warn`/`error`, log its length and the reason, never the text.
- **Time new boot steps** in `buildApp` with `startup.phase("name", () => ...)` (`lib/startup-timeline.ts`).

#### Recommended test setup: dual install on different ports

Marinara's maintainers run a separate test install at a different path on a different port (7820 instead of the default 7860), so feature work can be tested side-by-side with their normal install without disrupting their daily-driver characters/chats. **Strongly recommended for regular contributors** — it lets you exercise PR work in a real running engine without touching your own data.

**One-time setup:**

- **Dev directory** — where you edit code (e.g. `D:\dev\Marinara-Engine`). Your git working tree.
- **Normal install** — your day-to-day Marinara, e.g. `<AppData>\Local\MarinaraEngine`.
- **Test install** — a separate copy, e.g. `<AppData>\Local\MarinaraEngineTEST`, with a custom `teststart.bat` (or `.sh`) that launches the engine on **port 7820** instead of 7860 so it can run alongside the normal one. Test it at `http://localhost:7820/`.

**Startup sync ritual** — before any new task, sync silently. Only report to the user if something failed or if the pull brought in commits; otherwise just proceed. **Use PowerShell, not git bash** — git bash mangles robocopy's slash flags.

```powershell
# 1. Sync dev dir with staging (the active development branch; main is release-only)
git -C 'D:\dev\Marinara-Engine' checkout staging
git -C 'D:\dev\Marinara-Engine' pull origin staging

# 2. Mirror dev → test (excludes node_modules, .git, .claude, and the test launcher itself)
robocopy 'D:\dev\Marinara-Engine' '<AppData>\Local\MarinaraEngineTEST' /MIR /XF teststart.bat /XD node_modules .git .claude /NFL /NDL /NP /R:1 /W:1

# 3. /MIR purged user data — restore from your normal install
robocopy '<AppData>\Local\MarinaraEngine\packages\server\data' '<AppData>\Local\MarinaraEngineTEST\packages\server\data' /E /NFL /NDL /NP /R:1 /W:1
```

**Robocopy exit codes: 0–7 = success, 8+ = failure.** Don't treat any non-zero return as an error; check the actual code.

**Things the dev → test sync must NEVER touch in the test dir:** `teststart.bat` (custom launcher, hand-tuned), `.git` (the test dir is not a git repo), `.claude` (your personal config), `node_modules` (installed locally per dir).

**Per-task workflow with this setup:**

1. Work on a feature branch in your dev dir.
2. Copy specific changed files into the test dir (or re-mirror after big changes):
   ```powershell
   copy 'D:\dev\Marinara-Engine\packages\client\src\components\chat\Foo.tsx' `
        '<AppData>\Local\MarinaraEngineTEST\packages\client\src\components\chat\Foo.tsx'
   ```
3. Run `teststart.bat` in the test dir → engine builds and launches on port 7820.
4. Test at `http://localhost:7820/` — go through the pre-submission checklist below.
5. If green, commit + push from the dev dir, open the PR.

Two servers must never share one data folder: since 2.4.4 a dev watcher that loses the file-storage **writer lease** exits instead of retrying (#5312), so a `StorageWriterLeaseError` means two engines are pointed at the same storage. Home shows the installed build's identity (including a staging marker, #6307) beside the version — a quick way to confirm which build the test install is actually running. Dev and Playwright servers set `UPDATES_APPLY_DISABLED`, and the update route refuses any checkout on a development branch (#5646), so the release-channel selector can no longer stash-and-rebuild a working repo.

This pattern is highly recommended but not strictly required — if the user prefers a simpler one-directory workflow, respect that. Just don't pretend you've tested without actually running the engine somewhere.

### 4b. Approval and merge rules (who can actually land your PR)

Worth stating up front for a first-time contributor, because the answer is specific (`CONTRIBUTING.md`):

- **Pasta-Devs org members / owners** — no separate human approval required. Members with merge permission may merge a ready PR into `staging` themselves.
- **Outside and first-time contributors** — may submit **only to `staging`**, and need an approving review from repository owner **SpicyMarinara** *in addition to* the automated gates. An approving review from a different Pasta-Devs member does **not** substitute. (2.5.0 adds an `owner-approval-review` workflow that re-evaluates this as a commit status.)
- **`main`** — only SpicyMarinara may update or merge into it. Releases are promoted from tested `staging`; direct mainline work is reserved for owner-owned `hotfix/*` branches.

*(v2.4.0, #4361)* The outside-contributor approval gate is no longer recreated by **PR description edits, CodeRabbit comments, or non-owner reviews** — it still refreshes for base-branch changes and for approval-relevant SpicyMarinara reviews. So editing your own PR body to fix a typo no longer resets your approval. If a contributor is nervous about touching their PR after review, tell them this.

### 5. Pre-submission checklist (mandatory — do not skip)

**This applies to PRs to the Marinara engine ONLY.** Themes, custom CSS, and anything the user is keeping on their own install do not need this checklist (no PR = no review gate). Skip straight to "does it work in your install?" testing for those.

**For PRs to the engine: before you tell the user the PR is ready, walk them through this checklist and confirm each item ACTUALLY happened.** A passing CodeRabbit is the floor, not the ceiling — automated tooling cannot catch "the button is invisible in light mode" or "this throws when the textarea is empty." Only manual testing does.

Required for every PR:

1. **`pnpm check` passes locally.** Green is the floor.
2. **The user ran the app and clicked through the new feature themselves.** `pnpm dev` running, browser open, every code path the change touches actually exercised by hand.
3. **The user tried the obvious edge cases:**
   - Light mode AND dark mode
   - Mobile viewport (resize browser to ~400px wide, or use devtools device emulation)
   - Empty states (no data, empty input, missing field)
   - Error states (failed request, invalid input, network offline)
4. **For any UI change: visual consistency double-check.** Match the styling of the surrounding UI — same Tailwind classes, same color tokens, same spacing scale, same component patterns (buttons, inputs, modals, drawers). Don't introduce one-off styles or hardcoded colors. Verify the new element doesn't clutter available space, doesn't escape its container at narrow widths, and that all text remains visible at mobile sizes (no truncation, no overflow, no buttons running off-screen). Marinara's maintainers care about UI consistency a lot — a feature that *works* but looks "off" gets sent back.
5. **For any UI change: before/after screenshots captured for the PR body.** Animated GIF if the change is about interaction (typing indicators, modals, drawers, transitions).
6. **A `CHANGELOG.md` `[Unreleased]` entry** for any fix, behavior change, or feature (see §4).
7. **Automated checks recorded against the revision being submitted.** Note the commands, their results, and the commit they ran on. Rerun the affected checks after any later edit — results from an earlier revision do not validate changed code. For responsive layout, touch/keyboard, media playback, or browser-specific APIs, include **mobile Chromium and mobile WebKit** runs; say plainly which browsers or lanes were unavailable or skipped.

If the user hasn't done all of these, **do not let them submit.**

**Draft-then-ready (`AGENTS.md`, 2.5.0).** For an AI-assisted PR, open it as a **draft early** so ownership is visible. Before marking it ready: finish the implementation and required local checks, and run **CodeRabbit locally** — reproduce or trace each finding, fix the real ones, and record a code-based reason for each one rejected (never claim "zero findings" when some were dismissed). Then push and mark it ready in the same pass. Keep it draft only for unfinished work, unresolved substantive findings, blocked validation, or an explicit request. Pending GitHub CI and GitHub CodeRabbit are merge gates, not reasons to stay draft. Reuse the existing PR for follow-up fixes. None of this relaxes the manual-testing items above: an AI-run local review is not the user clicking through the feature. Smaller fully-working PRs land in one round; bigger ones that skip this checklist need three rounds of fixes and burn maintainer time.

### 6. PR body

Cover, in this order:

1. **Link the issue or feature request.** Every PR should reference the issue or Discord thread that prompted it (the one from Section 0). Reviewers use this to verify scope alignment — "fixes #123" or a link to the Discord thread at the top of the body. Required by the contributor guide.
2. **Summary** — one or two sentences, what changed.
3. **Why** — the user problem or rationale. Reviewers want to see the motivation, not just the diff.
4. **Architecture** — if multi-layer (shared schema → server → client), a short table or list. Otherwise skip.
5. **Known limitations** — be honest about scope trade-offs. Documented limitations help reviewers; hidden ones get found in review and slow things down.
6. **Test plan** — two parts. **Automated:** the exact commands, results, and tested commit (per checklist item 7). **Manual:** what the **user** manually verified, not what you (the AI) generated as a list. Be specific. "Tested adding a character" is weak; "Created a new character with description containing emoji and a 2KB markdown block; reloaded the page; confirmed render and edit both work in light + dark mode" is useful. **Only tick a checkbox if the user has actually performed that step.** See the anti-pattern below.
7. **Screenshots / GIFs** — required for any UI change (per `CONTRIBUTING.md`).
8. **Docs touched** — the `CHANGELOG.md` `[Unreleased]` entry, plus any `README.md` / `docs/*.md` you updated in this PR, so reviewers know to check the doc changes too. If a doc *should* have been touched but wasn't, flag it explicitly (and ideally fix it).

### 7. Walk the user through changes (in plain language)

The user is contributing as a learner. Apply the cross-mode plain-language narration rule especially carefully here — code changes are where beginners get lost fastest.

For each file you touch:
1. **Say what you're about to change in human terms BEFORE the edit.** "Now I'm going to add a new entry in this file — it's the master list of all the agent types the engine knows about, so we have to register our new one here before anything else will work."
2. **Make the edit.**
3. **Briefly say what just happened and why it matters.** "Done — the engine now knows the new agent type exists. Next we have to tell the server how to actually run it, which lives in a different file."
4. **Pause for the user.** Don't barrel into the next file. Let them ask questions if they have any.

If the user says "I already know how X works, you don't have to keep explaining," respect that — drop the X-related narration for the rest of the session.

If you don't know something, say so before guessing. The user values not wasting time over moving fast.

### Dispatching subagents for parallel review

When reviewing multiple PRs in one session (e.g., the user wants comments left on three PRs at once), dispatch one subagent per PR. For each:

- Scope to **one PR number** as the only task.
- Include the explicit framing: *"don't rush, treat this as your only task."*
- Ask for a specific output format ("leave one helpful review comment for the author covering: correctness, regressions risk, and one concrete suggestion").
- Sign off the comment with whatever attribution the user requested.

This avoids the stacking failure mode where one agent juggles three PRs and rushes all of them.

### Anti-patterns (contributor)

- **🔴 "All the test-plan checkboxes are ticked, ship it."** This is the most important anti-pattern. If *you* (Claude) generated the test plan and ticked the boxes, **you have not tested anything** — you wrote a list. The user must perform each step in a real browser before any box is ticked. If the box says "manually verified X in browser," the user must have actually done that. **Untick or rewrite any box the user can't honestly confirm they performed themselves.** This has burned the maintainer multiple times: PRs arrive with every box ticked and the feature visibly doesn't work the moment they open it. Treat AI-ticked boxes as a to-do list for the user, not as evidence the work is done. Hard rule.
- **"Let's also clean up X while we're here"** → Bug fixes shouldn't carry refactoring. Open a separate PR. Mixed-purpose PRs are harder to review and harder to revert.
- **"CodeRabbit passed, we're good"** → CodeRabbit is the floor, not the ceiling. It catches some code-level issues; it does not catch "the button is invisible in light mode," "this throws when the textarea is empty," or "this layout breaks on mobile." Manual testing is mandatory regardless of CodeRabbit status.
- **"The AI says it's fixed"** → The AI hasn't run the code. The user runs `pnpm dev`, reproduces the original failure, confirms the fix manually — then and only then is it fixed.
- **"Just add `--no-verify` to the commit"** → Pre-commit hooks failing means something is wrong. Fix the underlying issue. Skipping hooks is how broken commits land on `main`.
- **"Let me amend this commit and force-push"** → Only safe before opening the PR. After review starts, prefer new commits so reviewers can see what changed.
- **"I'll just fix this in the PR's branch directly"** → If it's not your PR, don't push to the author's branch. Leave a review comment.
- **"This bug is obvious from the code, no need to repro"** → Repro anyway. The "obvious" cause is wrong about a quarter of the time.
- **"It's a small change, I'll skip the edge cases"** → Light/dark, mobile, empty, error. Five minutes of clicking saves three rounds of review.
- **Adding "🤖 Generated with Claude Code" or "Co-Authored-By: Claude" trailers to commits/PRs** → Marinara's maintainers prefer commits and PRs that read as the contributor's work. Don't add bot self-attribution unless the user specifically asks for it.
- **"Let me push this small fix straight to `main`"** → Never. All changes go through a branch + PR + review. Even one-line "obvious" hotfixes. Merging to `main` is the maintainer's call, not yours.
- **"This new button looks fine, ship it"** → Match the existing styling. Same Tailwind tokens, same component patterns, same spacing. A working-but-visually-inconsistent UI element gets sent back in review.
- **"I tested it in dev mode, that's enough"** → If you've got the dual-install set up (see Section 4), test in the **test install** specifically. Dev mode HMR can mask production-only failures. (`pnpm smoke:production` now exists precisely to catch startup failures the Vite dev server can't.)
- **"I'll just double-click `start.bat` in my checkout to try it"** → It runs `git clean -fd` on `packages/*/src` and deletes every untracked source file. Use `pnpm dev`, or the non-git test install.
- **"The checks passed earlier"** → Earlier than what? Results only validate the revision they ran on. After any edit, rerun the affected checks before quoting them in the PR.
- **"I'll skip the CHANGELOG, the maintainers write release notes"** → Not since 2.4.2. Every fix, behavior change, or feature carries its own `[Unreleased]` entry.

### Validation reference

```bash
pnpm install              # first time or after dependency changes (pnpm is pinned via packageManager; launchers reselect it)
pnpm dev                  # runs shared build, then server + client with HMR
pnpm check                # clean:stale-client + impeccable + localization + Prettier + lint + e2e/token types + build (CI)
pnpm format               # apply Prettier to packages/**/*.{ts,tsx} when format:check fails
pnpm version:check        # version-bearing files must match root package.json (CI runs this)
pnpm guard:installer-artifacts   # no tracked .exe files (CI runs this)

pnpm regression           # = regression:node — the whole Node lane, auto-discovered from the filesystem, run serially
node scripts/run-regressions.mjs --filter <text>   # just the regressions whose path matches <text>
pnpm regression:<lane>    # named lanes that remain: prompt, noodle, security, extensions-security,
                          # professor-mari-shell-sandbox, runtime-integrity, release, static-cache,
                          # launcher-update, android-local-auth
pnpm smoke:ui             # only the @smoke Playwright tests, desktop Chromium, 1 worker (runs inside the required PR check)
pnpm regression:ui        # the FULL Playwright matrix: desktop-chromium, mobile-chromium, mobile-webkit
pnpm smoke:production     # compiled frontend + compiled server on isolated data (run pnpm check first)
pnpm test                 # Windows installer layout check + the Node lane (not the UI lane)
```

Focused browser runs don't need the whole matrix: `pnpm regression:ui e2e/core-flows.e2e.ts --project=mobile-webkit --grep "chat mode tabs" --workers=1`.

Dev URLs: client at `http://localhost:5173`, server at `http://localhost:7860`.

**Restart `pnpm dev` fully when you edit `packages/shared/**`** — the shared package only rebuilds at startup via `pnpm build:shared`. HMR handles client/server changes but not shared. `pnpm dev:server` and `pnpm dev:client` now build shared first themselves (#4327), but the rebuild-and-restart boundary still applies to an already-running process. Restart dev watchers from their terminal, not from Advanced Settings — the in-app restart (exit code 75) is supervised only by the platform launchers and `pnpm start`.

**How the lanes changed (2.4.3 → 2.5.0).** The old "~25 suites ending in the UI smoke" model is gone, and so are most per-area `regression:<area>` aliases (61 were removed in #5132 — `roleplay`, `providers`, `backup`, `localization`, `docs`, `sprites`, `agent-import-security`, `request-security` no longer exist; use `--filter`). `pnpm regression` is now Node-only: it builds shared once and gives **every regression file its own throwaway `DATA_DIR`, `FILE_STORAGE_DIR`, and `.env`**, so a regression can never read or lock the developer's real data. Playwright is its own lane. The POSIX terminal-shutdown regression needs **Python 3** on `PATH` (standard library only). Regression scripts must not import client modules that use the browser-only `@/lib` alias.

**What CI runs.** The required `pnpm-validate` PR check runs `pnpm check`, the `launcher-update`, `security`, and `release` regressions, version and installer guards, the **`@smoke`** Chromium suite, and `smoke:production` on desktop Chromium — a smoke failure blocks merging. Separate jobs cover Windows launcher regressions and container builds. The **full** three-browser matrix runs nightly on `staging`, on manual dispatch (`gh workflow run playwright.yml --ref staging`, optionally `-f expected_sha=<sha>`), and on PRs into `main` (#6661). CodeQL runs on PRs to both `staging` and `main`.

**State does not carry between Playwright projects.** Each project runs isolated servers and disposable fixture data (2.4.0). If a cross-project failure appears, don't "fix" it by sharing fixtures; that's the exact coupling the isolation removed. Stop anything already using the Playwright ports before a local run.

**Correction on testing (this changed).** Older guidance said Marinara had no meaningful automated test suite. **That is no longer true** — and the suite is now large: roughly 270k lines of regression and e2e test code at 2.5.0. Run the regressions covering the area you touched, and name them in the PR test plan.

**This does not relax the manual-testing rule.** The regression suites cover server logic, security invariants, and a thin UI smoke — they do not catch "invisible in light mode," "breaks at 400px," or "throws on empty input." Green regressions are an *additional* floor, not a substitute for the user clicking through the feature. Both are required; neither replaces the other.

### Version drift (if you touch any version-bearing file)

The Marinara root version lives in `package.json`. When that changes, **all** of these derived files must update in the same pass — `pnpm version:check` runs in CI and will fail if any drift:

| File | Role |
|---|---|
| `package.json` | Canonical application version |
| `packages/client/package.json` | Derived workspace version |
| `packages/server/package.json` | Derived workspace version |
| `packages/shared/package.json` | Derived workspace version |
| `packages/client/public/manifest.json` | PWA web-manifest version |
| `packages/shared/src/constants/defaults.ts` | `APP_VERSION` constant used by app + update checks |
| `win/installer/installer.nsi` | Windows installer output version |
| `win/installer/install.bat` | Windows installer banner text |
| `android/app/build.gradle` | Android `versionName` AND `versionCode` |

**↺ `README.md` is no longer synced or drift-checked** (changed after v2.4.0, when `versioning.mjs` still rewrote its release line). Its current-stable-release link is updated by hand **only when a stable release is actually published** — don't touch it in an ordinary version bump.

**Android rule:** `versionName` must match the app version. `versionCode` must increase monotonically for every shipped APK — never reuse, never decrement. Baseline: `versionCode` is **48** at v2.5.0 (42/43/44/45/47 at 2.4.1/2.4.2/2.4.3/2.4.4/2.4.6; 41 at 2.4.0), so the next shipped APK must exceed 48. Stable and tagged APKs are signed in CI with the maintainers' `ANDROID_SIGNING_*` keystore; the manual pre-alpha workflow may only publish a debug-signed **draft** APK. Release-identity sync also covers the Home release link and the What's New announcement.

*Note:* `CONTRIBUTING.md`'s own touchpoint table (9 rows) omits `packages/client/public/manifest.json`. The table above matches what `scripts/versioning.mjs` actually syncs and checks, so trust it over the prose table.

**Storage format is a separate version** (`AGENTS.md`). Root `storage-format.json` (`{"storageFormat": 7}` at 2.5.0) must equal `STORAGE_VERSION` in `packages/server/src/db/file-backed-store.ts`. Bump both **only** when the on-disk storage layout changes; `version:sync` never touches them. The launcher's downgrade guard reads this file from the update target, so a missed bump silently disables that protection.

**Don't edit these by hand.** Use the helper:

```bash
pnpm version:sync -- --android-version-code <next-code>
```

This bumps every derived file from the canonical root `package.json` version, plus sets the Android `versionCode` to the value you passed.

**Release flow** (only when the user is cutting a release, not for normal PRs):

1. Bump `package.json` version (canonical source)
2. `pnpm version:sync -- --android-version-code <next>`
3. `pnpm credits:check` (run `pnpm credits:sync` if stale)
4. Update `CHANGELOG.md` (turn the `[Unreleased]` entries into the new version's notes); for a stable release, update README's current-stable link to the matching tag
5. Open the **promotion PR from `staging` to `main`** and wait for its **full browser matrix** and required checks before merging; if the candidate changes, validate the new candidate. (A release without a promotion PR must run the full matrix manually against its exact candidate commit before tagging.)
6. Tag `vX.Y.Z` from the `main` commit containing that exact bump, and push the tag
7. Release workflows publish the GitHub Release (from `CHANGELOG.md`, trimmed at a whole entry with a link if it's too long), source ZIP, Windows installer, Android APK (versioned plus the stable `marinara-engine-android.apk` alias), and GHCR images; the workflows reject a tag that doesn't match the app version (`pnpm regression:release`)

Only SpicyMarinara can promote to `main`, so in practice this flow is the owner's. Never tag or publish without `pnpm version:check` passing first. Never commit built installer binaries — `pnpm guard:installer-artifacts` will fail. Built installers belong on GitHub Releases.

### When you don't know

If the user asks something specific to current engine state ("does 2.3.x have feature X yet?", "what fields does CharacterData have on the latest `staging`?", "is this PR going to conflict with the new generate-route refactor?"), fetch from the repo before answering. The bundled references are a snapshot.
