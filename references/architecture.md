# Marinara Engine: Architecture Overview

Marinara Engine is a local-first AI roleplay and chat frontend. Users run it on their own machine (Windows installer, Docker, Node.js clone, or Termux on Android), plug in their own AI API keys (OpenAI, Anthropic, Google, xAI, OpenRouter, Mistral, Cohere, or any OpenAI-compatible endpoint), and chat with AI characters.

Repo: https://github.com/Pasta-Devs/Marinara-Engine
Built by SpicyMarinara & Pasta-Devs. License: AGPL-3.0.

## The Big Picture

```
┌─────────────────────────────────────────────────────────────┐
│  Client (React / Tailwind v4, PWA-capable)                  │
│  - Chat UI  - Agents panel  - Lorebook editor               │
└──────────────────────────────┬──────────────────────────────┘
                               │ fetch /api/*
┌──────────────────────────────┴──────────────────────────────┐
│  Server (Fastify, TypeScript, file-native JSON store)       │
│  Routes: characters, lorebooks, agents, custom-tools,       │
│          generate, chats, presets, connections, etc.        │
│  ↓                                                          │
│  Generation pipeline (packages/server/src/routes/generate*) │
│   ├─ Assemble system prompt from: card + scenario +         │
│   │   connected chats + awareness + lorebook injection      │
│   ├─ Run pre-generation agents (inject, review, rewrite)    │
│   ├─ Stream response from the configured LLM provider       │
│   │    (with tool-calling if tools are enabled)             │
│   ├─ Run parallel agents (images, music, echo reactions)    │
│   └─ Run post-processing agents (state extraction, editor)  │
│  ↓                                                          │
│  File store: messages, chats, characters, personas,         │
│  lorebooks, presets, agents, custom-tools, etc.             │
└─────────────────────────────────────────────────────────────┘
```

**Package split (v2.3)** — the base Engine no longer ships optional agents. Hierarchical Maps, Calls, the table games, and other optional capabilities moved into **downloadable packages** with package-owned server runtimes (25,000+ lines removed from base; capability registries and compatibility bridges remain). See "Downloadable Agents (v2.3)" below.

## The Core Objects

### Character
A persona the user chats with. Follows the V2 character card spec. Stored as JSON in the file-native store (`DATA_DIR/storage`). Fields include `name`, `description`, `personality`, `scenario`, `first_mes`, `system_prompt`, plus Marinara-specific extensions (appearance, backstory, name/dialogue colors, schedule, etc.). Can be created in the app, imported from SillyTavern, imported from PNG files with embedded metadata, or browsed from Chub.ai via the **Card Browser** (renamed from "Bot Browser" in v2.3; "Browse Online" is now **Download Cards**, opening as "Cards Library" in the unified library shell).

See `references/character-cards.md`.

### Persona
The user's own identity in chats. Same shape as characters but simpler. Has name, description, personality, appearance, avatar, and optional custom colors. Multiple personas per user; the active persona is substituted for `{{user}}` macros in prompts. Caveat (v2.3): a **Roleplay chat created with no Persona stays persona-less end-to-end** (first snapshot, provider prompt, scene generation, combat context) — only Conversation falls back to the globally active Persona.

### Lorebook
A keyword-triggered knowledge base. Entries have `keys` (trigger words), `content` (what gets injected when a key is matched in recent chat context), and a bunch of tuning knobs (sticky, cooldown, delay, selective, grouped, recursive). Can be global, per-character, or per-chat.

See `references/lorebooks.md`.

### Preset
A full prompt configuration. Controls the order and content of system prompt sections, generation parameters (temperature, top-p, max tokens), and optional choice blocks. The default is **Marinara's Universal Preset v12** (`packages/server/src/db/default-preset.json`), and as of v2.0 presets carry prompts for **Conversation and Game modes** too, not just roleplay.

> **⚠️ Vocabulary change (v2.4.0) — get this right.** Reusable **Chat Settings Presets** were renamed **Settings Profiles** throughout Chat Settings, Roleplay quick setup, import/export, localization, and the docs. The word **preset** is now reserved for **prompt presets** (the object described above). A *settings profile* bundles reusable chat configuration; a *prompt preset* shapes system-prompt structure and generation parameters. Existing exported profile files remain importable. Use the correct term when advising — the UI and docs now distinguish them, and saying "preset" for a settings profile will send the user to the wrong panel. Guides: `docs/chats/settings-profiles.md`, `docs/prompts/presets.md`.

**What a settings profile holds** (`docs/chats/settings-profiles.md`): connection, prompt preset (the "prompt source" in Conversation), agents and tools, translation, Memory Recall, Advanced Parameters, and other reusable chat options. It does **not** carry chat-owned content — characters, persona, lorebooks, sprites, summary, tags, scene prompt — nor the conversation history.

Two constraints to state when recommending one:
- **Profiles work in Conversation and Roleplay only. Game mode does not show the profile controls.** Recommending a settings profile to a Game-mode user is advice that cannot be followed.
- A prompt preset is **one item inside** a settings profile, not a competing alternative to it. There aren't two rival preset systems.

*(v2.3.5)* The Chat Settings **Prompt Preset** area was reworked: Roleplay shows the preset-section editor directly once a preset is selected (no collapsible toggle); Conversation and Game show the effective prompt inline — editable in place, expandable to a full window, with a macro browser — and the redundant "open selected preset" shortcut was removed. Chat Settings also remembers which sections you left expanded.

### Connection
An API configuration pointing at an LLM provider: provider name, API key (encrypted at rest with AES-256), model, base URL, max context length. Users need at least one connection to chat. Per-chat overrides are supported. Connections can also target **non-LLM media providers** — `image_generation` and `video_generation` (v2.1) — which are handled by the media services, not the LLM provider registry; a video connection can be flagged **"Default for Videos"** as a per-chat fallback. Root-level connections can be reordered by drag or moved into folders via a saved Custom sort order (`connection.ts sortOrder`, `connection-folders.ts sortOrder`) (v2.1). A compact **Defaults** section (v2.2) lets each category — **Main, Agents, Images** (renamed from "Illustrator" in v2.3)**, Videos** — set an optional fallback connection; a failed generation retries once through that category's fallback (with a toast naming the fallback connection/model), while user cancellations and already-streamed partial text are protected from duplicate output.

### Agent
An autonomous LLM sub-system that runs during generation. As of v2.3, optional agents are **downloadable packages** installed from the official **31**-package catalog (Writer / Tracker / Misc — see "Downloadable Agents (v2.3)" below); **fresh installs contain none**. User-defined **custom agents** remain, and run in Conversation, Roleplay, and Game whenever agents are enabled (v2.3, #3692). Each agent has a phase (pre/parallel/post), a system prompt, an optional dedicated connection, and settings. All disabled by default — users enable only what they need. Each chat also has an **Enable Agents** master toggle (v2.3) gating all agent initialization and model calls: off means no selected agent (including package services) initializes or calls a model; the setting survives upgrades without re-enabling.

See `references/agents.md`.

### Custom Tool
A user-defined function the main chat model can call during generation. Three execution types: `static` (hardcoded response), `webhook` (POST to a URL), `script` (sandboxed JS, no network). Exposed to the model as OpenAI-compatible function definitions.

See `references/custom-tools.md`.

### Impersonate & guided generation

Two per-chat generation modes the references previously skipped, both documented in `docs/chats/guided-and-impersonate.md`.

**Impersonate** — the model writes the *user's* turn. Per-chat fields in `chat.schema.ts`: `impersonate`, `impersonatePromptTemplate`, `impersonateConnectionId`, `impersonatePresetId`, `impersonateBlockAgents`. *(v2.4.0)* refined with **server-backed prompt templates shared across browsers** (so a template set on desktop is there on mobile), read-only built-in previews, full-view editing, and a direct link to Quick Replies settings.

`impersonateBlockAgents` is the architecturally interesting one: an impersonated turn can deliberately **bypass the agent pipeline**, so trackers and post-processors don't fire on a turn the user didn't really write.

**Guided generation** — `generationGuide` and `generationGuideSource` on the chat feed `buildGenerationGuideInstruction` (`packages/server/src/routes/generate/`), which injects a steering instruction for the next reply. This is what backs the `/guided` slash command. Note that guided replies fire **Chat reply** lorebook triggers, not a separate trigger type (see `lorebooks.md`).

Related per-chat fields worth knowing: `daySummaries` (a day-level summary structure, distinct from Chat Summary — see the memory-surfaces table in `agents.md`) and `continueAddsNewline` (whether `/continue` inserts a newline).

### Personal Extension (removed v2.3.4 → **reintroduced sandboxed in v2.3.5**)
The old full-trust client extension feature (runtime CSS + JS with a scoped `marinara` API) was removed in v2.3.4. **v2.3.5 brought extensions back in sandboxed form**, and v2.4.0 expanded them (Browser Extension API v5, host-rendered UI contribution slots, a Full page access compatibility mode for legacy External Extensions).

Browser code runs in a Worker inside an opaque-origin sandboxed iframe with no Marinara DOM, origin, or network access; server code runs in a separate Node process under macOS Seatbelt or Linux Bubblewrap (unavailable on Windows/Android, where it fails closed). Professor Mari authors drafts; only the user can approve the exact SHA-256 hash. Third-party imports live in a separate **External Extensions** section behind two gates (`ENABLE_EXTERNAL_EXTENSIONS=true` plus a Danger Zone opt-in).

Schema: `packages/shared/src/schemas/personal-extension.schema.ts`. Injector: `packages/client/src/components/layout/PersonalExtensionInjector.tsx`. See `references/extensions.md` for the full model — don't answer extension questions from this summary alone.

### Professor Mari (built-in assistant)
Marinara's built-in assistant, seeded at first run and not deletable. **As of v2.0 she is the Home-screen assistant** (no longer a normal Conversation-mode character): users talk to her from the Home screen, where a Pi-backed *workspace agent* can inspect the local app and — with browser approval for database changes — create content (characters, personas, lorebooks, chats) and navigate panels. She replaced the standalone character/persona/lorebook *maker* modals and their generation routes, removed in v2.0. As of v2.3, Conversation **About Me** drafting also goes through Mari — the per-editor AI Write controls (with their separate model connection/source settings) were removed; About Me and the `update_about_me` tool remain Engine built-ins, not packages.

See `references/character-cards.md` → The Professor Mari Pattern, and `docs/PROFESSOR_MARI.md`.

## Downloadable Agents (v2.3)

v2.3.0 restructured the engine around **downloadable capability packages**. Optional agents no longer ship in the base Engine — they install from the in-app **Agents → Download Agents** library, backed by the official **Pasta-Devs/Marinara-Agents** catalog of **31** verified packages as of v2.4.0 (6 Writer / 8 Tracker / 17 Misc). Key points:

- **Fresh installs ship no optional agents**; upgrades from ≤2.2 migrate agent selections, settings, and history automatically.
- **Package-owned server runtimes** — Hierarchical Maps, Calls, the six table games, and the other optional capabilities moved out of the base Engine (25,000+ lines removed; capability registries and compatibility bridges remain).
- **Lifecycle** — installed packages check the catalog at server startup and auto-upgrade to the newest compatible version before runtimes activate (v2.3.1); offline, incompatible, missing, or failed updates keep the previous version; verified runtime failures roll back automatically; incompatible versions are quarantined before their hooks can crash generation (#3647).
- **Capability API 1.3** (v2.3, #3690) — host services for packages: safe model routing, persistence, history/checkpoints, resources, logging, transactions, client contribution loading, and visible readiness/retry states.
- **Mode badges** — the catalog shows Conversation/Roleplay/Game compatibility badges and supports search by mode (v2.3, #3676).
- **Per-major catalog lanes** (v2.3, #3712) — each Engine major installs/updates only from its matching lane: `catalog/v2/catalog.json` for Engine 2, `catalog/v3/` for Engine 3, with `catalog/catalog.json` as a legacy v2 alias.
- **Custom GitHub agent repositories** (v2.3.4, #3861) — a disabled-by-default third-party agent-source path alongside the official catalog: manual preview/apply (no auto-sync), explicit per-repo trust confirmation, stable sync identity, and bounded SSRF-safe archive validation.
- **Import/export hardening** (v2.3.4, #3953) — imported agent files can no longer install bundled custom functions, grant themselves tool access, or overwrite a curated Agent by reusing its internal type; exports no longer bundle function definitions, imports land under a fresh custom identity, and the user must review and explicitly re-attach tools.

See `references/agents.md` for the package catalog and per-agent details.

## Chat Modes

Marinara has four chat modes (Conversation, Roleplay, Game, and **Noodle**, added in v2.2). Each has a different prompt assembly pipeline and UI.

### Conversation Mode 💬
Discord-style DMs. Casual text, no asterisks, no narration. Characters have:
- **Schedules** — weekly timetables of activities, generated by an LLM based on personality. A global IANA **timezone selector** (v2.3; browser-detected default, overridable, device-syncing) is honored by schedule generation, presence, autonomous messages, temporal prompt context, and background polling — a blank `TZ=` inherits the host timezone (#3590). Routine-summary generations use an 8,192-token default (up from a 512-token ceiling) with low reasoning effort requested (v2.3, #3696)
- **Statuses** — derived from schedule: online, idle, dnd (do-not-disturb), offline
- **Talkativeness** — 0–1, affects autonomous messaging rate
- **Selfies** — characters can emit `[selfie]` to generate a selfie-style image
- **Memory commands** — characters can send memories to other characters via `[memory: target="..."]`
- **Scenes** — conversation characters can initiate temp roleplay chats via `[scene: ...]`. A scene-prompt setup dialog for user- and character-initiated scenes remembers POV, tense, and optional prompt wishes for the next scene generation (v2.2)
- **Turn games** — a Conversation-mode table-game family of six games. As of v2.3 they are **downloadable packages** with package-owned runtimes (see Downloadable Agents (v2.3)): they surface as **Commands** toggles (no Add Agent entries), and installed games hot-activate their slash commands without an Engine restart (#3699; route-bearing packages keep a safe restart path). The shared-engine layout (`packages/shared/src/features/turn-games/`, registry of six engines) describes the pre-2.3 code. Each has an in-character setup modal, a `[command]` token, a slash command, an NL launcher, per-chat toggle, bot turns, and board state (route `/api/turn-games`). Engines: `[uno]` (v2.0), `[chess]`, `[poker]` No-Limit Hold'em 2–8 players with seeded dealing, side pots and a selectable character dealer (`/poker`), `[eightball]` 8-Ball Pool with a real 2D physics sim and selectable announcer (`/8ball`, alias `/pool`), `[tic_tac_toe]` (`/tictactoe`, alias `/ttt`), and `[rock_paper_scissors]` best-of-N with hidden throws (`/rps`) (the last two added in v2.2.1)
- **Emoji** — Conversation supports Discord-style standard `:shortcode:` emoji with autocomplete (e.g. `:crying:` renders the Unicode emoji, `:cry…` shows suggestions) alongside custom emoji (v2.2, #3515)
- **Reactions (v2.1)** — characters can emit `[react: emoji="😂"]` (or a custom `[react: emoji=":name:"]`) to badge the user's latest message, or `[react: emoji="🙄" to "Character Name"]` to react to another character; can target an individual character's segment within a merged multi-character reply, and a react to the persona name (or "User") targets the user's latest message. Conversation-mode only (ignored elsewhere). Gated by a per-command **Reactions** card toggle (setup wizard / Chat Settings). Grammar in `character-commands.ts` REACT_RE (also accepts `[react: "😂"]` / `[react: 😂]`).

Group DMs are supported. As of v2.3.4 (#3887), multi-character Conversations offer **Grouped and Individual response modes** with sequential, smart, manual, mention-directed, and autonomous character selection, a shared daily check-in budget, and a token-use warning — superseding the v2.3.1 single-merged-generation-only model. In Grouped mode the bubble display still splits lines per speaker with inherited identity (#3609). Mentions always select the mentioned responder(s); the Reply When Mentioned toggle was removed (#3891). Conversation chat check-in ceilings accept explicit numeric overrides (v2.3.4, #3864).

**Calls (v2.1; downloadable package since v2.3)** — Discord-style audio/video calls inside Conversation chats. As of v2.3 this is the **`conversation-calls` package** — renamed user-facing to "Calls" with package IDs and the `/api/conversation-calls` route path preserved — and it must be installed from Download Agents (see Downloadable Agents (v2.3)). **Local Whisper is Calls-owned**: Connections shows the Local Speech Model controls only while the package is installed, and uninstalling removes downloaded Whisper models (Whisper discovery with unset `DATA_DIR` fixed in #3671; package v1.0.4 stopped hardcoded fallback replies and dropped the provider-native JSON mode requirement, #3685). Gated globally by `ttsSettings.callAudioEnabled` (default false, Settings → TTS) plus a per-chat opt-in. Characters can initiate **incoming calls** (with an optional greeting that plays after the user answers). The desktop/mobile call surface has a call-only chat, speaking highlights, mute / camera / screen-share, a soundboard, minimized active-call popouts, call history cards, and a **post-call summary** injected back into the chat.
- **Voice input** — `callAudioInputMode` (`tts.ts:142`, default `local_whisper`) selects the mic path: `system` (provider-native audio), `auto`, `transcribe` (browser speech recognition), or `local_whisper` (downloadable Whisper Tiny/Base transcription). `callVideoInputEnabled` (`tts.ts:144`, default false) gates the camera/screen-share UI. (`callSttConnectionId`/`callSttModel` are deprecated.)
- Character **video presence** in calls, the **Sprites → Clips** editor, and the in-call `[custom_clip: …]` / `[react:]` commands are covered in `references/character-cards.md`.

### Roleplay Mode 🎭
Traditional creative-writing roleplay. Rich narration, prose. Supports:
- Full agent stack (world state, trackers, sprites, backgrounds, weather, combat)
- VN-style character sprite overlays — a chat can show all enabled sprite owners (the hard-coded 3-sprite cap was removed in v2.1)
- Scene videos (v2.1) — per-image **Animate** and Gallery Video actions render MP4s via a Video Generation connection, shown as pinnable/draggable video overlays (shared with Game Mode galleries)
- Custom backgrounds with crossfade transitions
- Weather particle effects (rain, snow, thunderstorm, fog, cherry blossoms, aurora)
- Time-of-day lighting (dawn, day, dusk, night)
- Game HUD with character stats, quests, world state

**Visual Novel — fully retired (v2.4.0, #4368). Do not offer it as a mode.** v2.2 removed the separate tab and routed legacy/imported VN chats under **Roleplay**; **v2.4.0 removed the mode identifier and its remaining compatibility branches outright** — from active schemas, runtime routing, UI labels, imports, and current documentation. The supported modes are now consistently **Conversation, Roleplay, Game**, and `chatModeSchema` is literally `z.enum(["conversation", "roleplay", "game"])` (`packages/shared/src/schemas/chat.schema.ts`). Game dialogue labels use "Dialogue Box" wording.

**Chat Summary (v2.2)** — the Summary Connection has a maximum-output-size setting (`prompt.schema.ts:42` `maxTokens`, default **4096** tokens) applied to both manual and automatic summaries. A custom Roleplay Chat Summary prompt now applies **globally** across all roleplay chats, not only the currently open chat. v2.3 removed the 2,000-char per-source-message truncation and the 64 KiB compiled-summary ceiling in `chats.json`. v2.3.4 (#3864) removed the 50-message ceiling on Conversation and Roleplay recent-summary tails (conservative defaults and cost guidance retained).

### Game Mode 🎮
A shipped mode (v2.0) — Roleplay + JRPG game loop. The model acts as GM; the engine handles mechanics. State machine with `exploration`, `dialogue`, `combat`, `travel_rest`. Tactical combat UI, dice rolls, skill checks, reputation, elemental reactions, quest tracking, auto-journaling. v2.0 also added a Roleplay HUD / Tracker Panel with **editable field locks** (manually pinned tracker values survive generated updates; v2.1 hardened this so tracker/custom-agent update agents can't bypass a locked field by renaming or replacing the locked row at the same position), **Game-Mode custom-agent selection** in Chat Settings, a setup wizard, and checkpoint restore. Routes: `/api/game`, `/api/game-assets`.

**Tactical Combat (v2.3)** — a **Combat Preference** (setup wizard; changeable via Chat Settings → Combat Style) chooses between classic narrative combat and **tactical grid-RPG battles**: a terrain-painted battlefield with scene-matched backdrops, unit classes, party formations, per-unit movement/attack ranges, counters/crits/misses, and a full enemy phase on a deterministic seeded engine at four difficulty levels — with animated movement, damage popups, a draggable unit inspector, staged translucent move previews, restartable encounters, and a mobile layout. Distinct from the downloadable `combat` agent package.

**Hierarchical Maps (v2.3)** — a downloadable Tracker Agent package (see Downloadable Agents (v2.3)), enableable in Roleplay and during/after Game creation: a world-map surface plus a full hierarchical map editor (#3691), with its controls nested inside its Chat Settings → Agents entry (#3679). It fully obeys the per-chat Enable Agents toggle (UI, prompt generation, lorebook previews, retries, tracker patches, carryover, checkpoints). Troubleshooting: incompatible 1.0.x runtimes are quarantined (fixes "t.select is not a function"); #3723 ships a one-time correction removing the 2.3.2 migration's accidental Maps auto-selection; inactive-chat Maps calls no longer block sends ("Failed to flush 1 game-state patch callback").

**Scene videos (v2.1)** — a dedicated Video Generation connection (`chat.ts gameVideoConnectionId`/`sceneVideoConnectionId`, selected under Chat Settings → Agents → Scene Videos or the setup wizard) renders MP4s into a scene-video store; they surface in the Gallery **Videos** tab with per-image **Animate** buttons and pinnable/draggable video overlays (also available in Roleplay galleries).

**Turn storyboards (v2.1)** — a Prompt Director splits a completed GM narration into 2–6 anchored keyframes (usually 4), renders their media concurrently, and shows them in a draggable viewer that follows the current story section (reopenable from Gallery). Keyframes land in the Gallery Images tab; with the off-by-default **Automatic Storyboard Animations** each is also animated into an MP4. Per-chat: `gameStoryboardAutoIllustrationsEnabled`, `gameStoryboardAutoGenerationEnabled` (`chat.ts:477-480`); a manual "Create storyboard" button needs the Game Illustrator image connection. Types `game.ts:611-681`; see `docs/STORYBOARD_ENGINE_GUIDE.md`.

**Media prompt presets (v2.1)** — three per-chat selectors: **Illustration Prompt**, **Animation Prompt**, **Game Video Prompt**. Read-only built-ins: Still Keyframes, Comic Page, Colored Manga, B&W Manga (`game-storyboard-prompts.ts:85-113`) and **Cinematic Scene Video** (`game-video-prompts.ts:31-34`, the default Game Video Prompt); users get chat-local editable copies (`chat.ts` gameStoryboard*/gameVideo* template fields). The global video template key is `game.video` (renamed from `game.omniVideo` in v2.1; the legacy key is still read as a fallback).

**Media presets (v2.2)** — new storyboard prompts **Comic Page Animation** (clip-duration panel budgets, causal panel order) and **Comic Page Video**, plus an **Anime Episode** presentation for Game Mode with coordinated **Anime Game Prompt** / **Anime Episode Director** / **Anime Game Video** defaults and setup-time keyframe targeting. A `{{gameStoryboardKeyframeCount}}` GM macro is available in prompts (alongside `{{char}}`, `{{user}}`, etc.).

**Session History (v2.2)** — an **Initial Game Setup** section exports the complete campaign setup (preferences, prompt choices, visual/storyboard options, safe model descriptors, and effective params, no credentials/local IDs); as of v2.3 the download is a versioned **`.marinara-game-setup.json` bundle** (no longer `.txt`) that refills the New Game wizard on import, remaps local resources, warns about missing ones, and requires a replacement GM connection when necessary (#3701). Per-turn **Peek Prompt** actions open the exact cached prompt sent for a historical GM turn; and completed sessions support **read-only deterministic replay** (click-through narration, stored presentation cues, forks locked to the originally chosen option). Game setup also shows visible progress with an elapsed timer; the final Game-setup watchdog was raised from 300 to 500 seconds (v2.3, #3684).

**Game Illustrator dynamic prompts (v2.1)** — an optional Illustrator toggle (Chat Settings → Agents → Illustrator) for **Dynamic LLM Prompt Generation**: `gameImageDynamicPromptEnabled` (`chat.ts:250-251`) asks the chat/prompt LLM to rewrite Game Mode NPC-portrait, location-background, and key-moment illustration prompts before image gen (optionally via `illustratorPromptConnectionId`). Distinct from the post-processing `illustrator` agent. Related: `gameImageAutoGenerationEnabled` (`chat.ts:248`).

### Noodle 🍜 (fake social network — headline v2.2 feature)

Marinara's **pretend, in-app social timeline** — a Twitter/X-style feed where every account belongs to your own world. It is fully local, off by default, and connects to no real network. Opened from a top-bar **@** button (which replaces the chat area and shows a flavor `https://noodle.local` address bar). Server-backed: `packages/server/src/routes/noodle.routes.ts` under route prefix **`/api/noodle`**; storage in `noodle.storage.ts` / schema `db/schema/noodle.ts`; services in `packages/server/src/services/noodle/`; client `components/noodle/NoodleView.tsx`. Docs: `docs/noodle/overview.md`, `docs/noodle/settings.md`, and `docs/development/noodle-internals.md`.

**Accounts.** Every account is an existing entity: your **personas** (each persona gets its own Noodle account; an in-Noodle account switcher changes who you post as without touching the app's active persona), any **characters** you invite from your library, **Professor Mari**, and an optional set of built-in **"random user"** accounts. Personas participate directly — you write posts by hand as your persona. Persona authorship is preserved across account switching (v2.3): posts/replies retain their originating persona account and snapshot, timeline prompts identify personas by handle and a stable identity key, and carryover summaries name the authoring persona; `@handle` mentions open profiles, and macros resolve before refresh prompts (#3687). **Professor Mari is excluded from Noodle by default** (v2.3, #3598) — a default-ON setting keeps her out of account discovery and future generated activity (existing history kept).

**Timeline & posts.** The feed loads the 160 most recent posts across two tabs (**Main** / **Following**). Posts carry text (≤4000 chars), one image, **polls** (2–4 options, revotable), likes, **reposts**, nested **replies** (≤2000 chars, repliable/likeable/media-attachable), and `@handle` **mentions** with prefix-matched autocomplete. Your own posts can be edited/deleted. **Notifications** (bell) split into Likes / Follows / Replies (replies include posts mentioning your persona's handle).

**Profiles.** Each character gets a per-character **Noodle profile** (display name, `@handle`, bio, location, avatar, banner) written by the AI the first time a refresh includes them; direct-invite characters' profiles are hand-editable (v2.2.1, #3551) and preserved across card refreshes. Your persona's profile is editable; character profiles are otherwise AI-authored. Following is one-directional (your persona → invited characters that already have a profile; random users can't be followed).

**Refresh (generation).** **Refresh timeline** sends your persona, invited accounts, and opted-in chat context to a chosen **Generation connection**, and in one run the model writes a batch of posts, replies, reposts, likes, follows, polls/votes, and any missing character profiles. Refreshes run **manually** or on an automatic schedule — **Refreshes/day** (server-side scheduler `noodle-refresh-scheduler.service.ts` hitting `/api/noodle/refresh`, so the page needn't stay open); setting it to **0 disables automation**. Long-term recall: a refresh may sample up to three posts older than 48h so characters revisit past activity. Prompt assembly lives in `buildRefreshPrompt()`; as of v2.3 the **Noodle Prompt is user-editable** — an editable prompt at the top of Noodle Settings (full-screen editor, one-click default restore) whose canonical default contains the complete adult-platform, persona-authorship, interaction, and JSON instructions with the timeline voice text appended last, superseding the v2.2 Voice-&-Tone-only override model (schema contract `noodleGeneratedRefreshSchema` still applies). Refreshes (v2.3) choose active participants before first-time profile generation, skip already-profiled characters, and send only the selected cards; world/lore context and chat carryover each get a fixed 8,192-token budget. Every refresh now includes the user's current local time, plus an optional setting attaching participating characters' existing generated schedules for the current day (v2.3.4, #3886). Local-model robustness (v2.3.4, #3881/#3871): refresh parsing recovers adjacent JSON objects (posts/interactions/follows all preserved) and accepts single-object array wrappers for generated profiles — no more HTTP 500 on first-time bio generation.

**Multimodal / vision (v2.2).** Refresh models can inspect images attached to recent posts/replies (up to eight most-recent relevant images, deterministic labels, bounded inputs) via `noodle-vision.ts`; if a model rejects vision content the refresh automatically retries **text-only**. Optional **image captioning** with a *separate selectable vision connection* lets text-only timeline models understand attached images (#3505).

**Social-memory carryover.** Two independent toggles bridge Noodle and chats: **Carryover to chats** (Noodle activity → a chat's prompt, via `noodle-context.ts` `buildRecentSocialMediaActivityBlock()`) and the per-chat **Allow Noodle references** (a chat's recent messages, and optionally the character's Conversation schedule status, feed a refresh). Carryover targets Conversation, Roleplay, and Game.

**Tuning settings.** Optional **Enhanced tone & continuity** (Settings → Timeline Writing, off by default) grounds each account's voice in its own Personality/Description/Backstory and encourages cross-post reactions/recall. Generated images are capped per-refresh via **Images/refresh** (0–50, default 3) rather than a daily cap. Optional **Lorebook context** (off by default) scans post/reply text and active profiles for keyword matches and injects activated entries with a Noodle-specific token budget. Character folders can be **bulk-invited**. Responsive **mobile shell** with a full-screen drawer and pinned bottom navigation.

## Prompt Assembly (Simplified)

For a roleplay turn, the system prompt is assembled roughly as:

1. **Preset sections** (ordered, user-configurable) — typically:
   - System role / jailbreak
   - Character description + personality + scenario — as of v2.3.4 (#3817) character/persona sections keep a guaranteed editor order across preset markers, fallbacks, agent lore, and Game/scene card contexts: Description, Personality, Backstory, Appearance, Scenario, then Example Dialogue when present
   - Persona description
   - World info / lorebook entries (injected based on keyword matches in recent messages)
   - Examples of dialogue
   - Chat summary (if enabled and conversation is long)
   - Connected-chat awareness (if this chat is linked to another)
   - Agent injections (from pre-generation agents)
2. **Recent message history** — the chat's last N messages
3. **Depth-injected prompts** — special prompts inserted at specific depths in the history
4. **Post-history instructions** — note (v2.0): post-history *system* sections are now injected as **user-side** content at a configured depth (preserving metadata) rather than glued onto the pre-history system prompt

**v2.0 prompt-assembly changes worth knowing:** max-context enforcement prioritizes non-history material first and *then* windows recent history (preserving response/free-token headroom); assistant **prefill steering** seeds the generated message with the configured prefill; and **visible tracker context** is included. (CHANGELOG [2.0.0].)

**v2.1 prompt-assembly changes:** in 1:1 Conversation chats, assistant turns in prompt history are now **speaker-labeled with the character name**; **impersonate** assembly drops conflicting non-marker sections on fallback presets while explicitly-selected impersonate presets keep their normal sections (#3209), and smart group response order no longer overrides `/guided` or `/impersonate` (#3212); readable text attachments are no longer pre-truncated to 60,000 chars — they are bounded by the model's context window. (CHANGELOG [2.1.0].)

**v2.3.4: prompt leaf content is verbatim.** Card fields, persona, lorebook entries, memories, and scene text are no longer HTML-escaped — angle-bracket markup (`<thinking>`, `<scenario>`, inline `<div>`) reaches the model exactly as written. This finalizes leaf content as verbatim for the local single-user threat model, superseding the earlier prompt-boundary escaping (#3108) and the hardened-assembly untrusted-card-text escaping; structural section wrappers and agent value/attribute escapers are unchanged.

For conversation mode, assembly is simpler: system prompt (mode-specific framing + character card) + name lists + fetched context + message history.

**v2.3 Conversation-assembly changes:** Peek Prompt groups Conversation turns under a "Chat History" section; join/leave notices become timestamped history events only after chat start; reaction syntax lives in "Commands"; merged-group speaker-prefix and character-only response boundaries emit last in the preset's XML/Markdown/plain format; and identity wording fits both 1:1 and group chats (with a startup preset migration).

The assembly lives in `packages/server/src/routes/generate.routes.ts` and `packages/server/src/routes/generate/` helpers. For contribution work, note that generation logic has been factored into focused modules (prompt, provider, context, and command-runtime concerns — separating Conversation commands, Professor Mari actions, turn games, provider setup, and post-processing) rather than a single monolithic route file. It is **not user-extensible without forking**.

## Data Storage

**File-native JSON storage throughout** (as of v2.3.0), under `DATA_DIR/storage` (default `packages/server/data/storage`). v2.3.0 removed the retired database compatibility stack (runtime backend switch, startup migrations, importer/repair readers, migration scripts, DB-file backup handling, external ORM deps). The file store enforces primary/natural-key constraints; graceful-shutdown flush was hardened (#3602), native profile imports are atomic (#3683), and packages resolve capability-owned schemas by registered name (#3647). All user data lives in the file store:
- chats, messages, chat_folders
- characters, personas, groups, persona_groups
- lorebooks, lorebook_entries
- presets, regex_scripts
- connections (with encrypted API keys)
- agents (both built-in configs and custom agents)
- custom_tools
- themes and `installed_extensions` (**Personal Extensions returned in v2.3.5** — records carry the approved SHA-256 hash, enabled flag, declared capabilities, and revision history; anything from *before* the 2.3.4 purge is gone for good and is not restored by 2.3.5)
- automatic backups (*v2.4.0*) — rotating daily / weekly / monthly full backups configured under **Settings → Advanced → Backup & Export**, with the last run and failure state surfaced in the UI. Native profile and full-backup ZIP exports now stream to disk with bounded JSONL table shards, so large libraries no longer fail with `Invalid string length`.
- gallery (generated/uploaded images **and videos**; v2.1 renamed "clips" → **Videos** and split galleries into Images/Videos tabs, newest-first)

Fully local. Copying `DATA_DIR/storage` (or the whole `DATA_DIR`) still works, but as of v2.4.0 it is no longer the primary answer — there is a first-class scheduled backup with UI-visible run and failure state. Point users at **Settings → Advanced → Backup & Export** and `docs/data/backup-and-restore.md` first, and treat the directory copy as the manual fallback. Sharing = exporting individual objects as JSON (characters, presets, lorebooks all have export endpoints).

## API Surface (Key Endpoints)

All under `/api/*`:
- `/api/characters` — CRUD, groups, import/export (JSON/PNG)
- `/api/personas` — (within characters routes)
- `/api/lorebooks` — CRUD, entries, export
- `/api/presets` (`/api/prompts`) — CRUD, sections, choice blocks
- `/api/connections` — CRUD, duplicate, test
- `/api/agents` — CRUD, toggle, echo messages
- `/api/custom-tools` — CRUD
- `/api/generate` — main SSE generation endpoint with the full agent pipeline. v2.3.4: healthy SSE replies keep streaming after a backgrounded tab becomes visible again, with a grace period before falling back to the persisted full response only when the resumed stream makes no progress; Roleplay's Stop button now sends the explicit server-side cancellation through the authenticated API client (CSRF protection no longer discards it)
- `/api/chats` — CRUD, messages, connect/disconnect
- `/api/scene` — create/plan/conclude scene branches
- `/api/conversation` — schedule, status, autonomous message checks
- `/api/encounter` — combat init/action/summary
- `/api/game`, `/api/game-assets` — Game Mode loop and per-game asset management
- `/api/turn-games` — Conversation turn games (UNO, chess, poker, 8-ball pool, tic-tac-toe, rock-paper-scissors)
- `/api/noodle` — Noodle fake-social-network mode (v2.2): timeline `GET /`, `/settings`, `/refresh-schedule`, `/accounts/:id`, `/invites` (+`/invites/bulk`), `/posts` (CRUD + `/posts/:id/interactions` for likes/reposts/replies/votes), `/timeline` reset, `/refresh` and `/refresh/images` (generation)
- `/api/conversation-calls` — Calls (v2.1; renamed from "Conversation Calls" in v2.3, route path unchanged; requires the Calls package): `GET /chat/:chatId/status`, `POST /start`, `/:id/accept|decline|end`, `GET|POST /:id/messages`, `/:id/interruption|idle|media`, soundboard CRUD (`/soundboard`, `/soundboard/upload`, `/soundboard/:id/file`, `DELETE /soundboard/:id`), and character/persona video-clip endpoints (`/character-videos/:id` + `/generate`, `/custom/generate`, `/file/:kind`, `/custom/:clipId/file`; `/persona-videos/*` mirror)
- `/api/gallery/generate-scene-video`, `/api/gallery/scene-videos/:chatId`, `/api/gallery/scene-videos/file/:chatId/:filename` — scene-video generation (v2.1; rejects a connection whose provider ≠ `video_generation`); parallel `/api/game/scene-videos/*` plus `gameVideoConnectionId` on Game setup. Roleplay and Game scene-video files stream with standard byte-range and HEAD handling instead of buffering complete MP4s (v2.3.4, #3811)
- `/api/professor-mari/workspace` — Professor Mari's workspace agent: AI-assisted creation of characters/personas/lorebooks/chats. **This replaced the standalone `/api/character-maker`, `/api/lorebook-maker`, and `/api/persona-maker` routes, which were removed in v2.0.**
- `/api/bot-browser/*` — the Card Browser (user-facing rename from "Bot Browser" in v2.3; the route path is unchanged): import from Chub, CharacterTavern, JannyAI, Pygmalion, Wyvern, DataCat. Provider fetches are consolidated behind `safeFetch` (#3617)

Full list in `docs/development/frontend.md` (moved from `docs/FRONTEND.md`).

## Providers Supported

- OpenAI (incl. ChatGPT subscription), Anthropic (incl. Claude subscription), Google (Gemini + Vertex AI), xAI (Grok), Mistral, Cohere, OpenRouter, NanoGPT
  - **Local-auth (CLI-login) providers** — `openai_chatgpt`, `claude_subscription`, and (v2.2) **`grok_subscription` "Grok CLI (Subscription)"** for SuperGrok / X Premium+ users, routing chat through a local `grok` CLI login with **no API key or base URL fields** (`providers.ts:18` `LOCAL_AUTH_PROVIDERS`). Grok CLI prompts are now delivered via `--prompt-file` (fixes E2BIG), so an explicitly set **Max Context Window is honored** rather than silently capped at 32k (32k stays the default).
  - **xAI default model (v2.2)** — new xAI connections now prefill **Grok 4.5** (`grok-4.5`, 1M context; `grok-4.5-latest` also available).
- Any custom OpenAI-compatible endpoint (use "Custom" provider). *(v2.4.0, #4061)* OpenRouter routes **Krea** models through its dedicated Images API, retaining image-only modality detection for every current `krea/` model — which is why a `krea/` model behaves as image-only. Documented model options include **GLM-5.2** (`glm-5.2`, 1M context / 128K output; native Z.AI connections send `thinking.type`/`reasoning_effort`) and OpenAI **GPT-5.6 Sol/Terra/Luna** (`gpt-5.6` is the Sol alias; `gpt-5.6-sol-pro` pro-mode alias; 1.05M context / 128K output; Responses API routing, GPT-5.6 `max` reasoning-effort mapping, reuse of the Exclude Past Reasoning toggle) — both added v2.2 in `model-lists.ts`.
- Local Model runtime: a **llama.cpp sidecar** (MLX on macOS Apple Silicon) that runs downloadable local models — including the built-in **Gemma 4** option offered on the Local Model card. When the native-tool-calls toggle is on it launches `llama-server` with `--jinja`, giving **OpenAI-compatible native tool calling**; useful both for offloading tracker/scene-analysis work and for running custom tools locally
- Image gen: Pollinations, Stability AI, Together AI, NovelAI, **Venice.ai** (v2.3, #3682), **Z.AI** (v2.4.0, #4350 — native service with **GLM-Image** and **CogView 4**, model-aware aspect-ratio sizing, authenticated native requests, safe local storage of returned image URLs; note Z.AI also appears as a *text* provider above, so don't assume image support is absent), **Atlas Cloud** (v2.3.5, #3989 — image **and** video, curated starter models, text/reference image requests, async job polling, connection tests, Game/scene-video routing), ComfyUI (with custom workflows), AUTOMATIC1111. NovelAI **V4.5** gained persistent style plates (independent strength/fidelity, subject-count framing; v2.3, #3725/#3726); v2.3.4 (#3758): image prompt review shows the subject-count-resolved dimensions actually sent to native NovelAI, Prompt Prefix count tokens stay out of scene sizing, and legacy partial profiles are backfilled
- **Video Generation (v2.1)** — a separate connection provider type (`video_generation`, in the APIProvider enum) handled by `services/video/video-generation.ts` rather than the LLM provider registry. Powers scene videos, Game storyboards, animated expression sprites, and call video presence. Five service profiles (`VIDEO_DEFAULTS_SERVICES`) with default models: Gemini Omni (`gemini-omni-flash-preview`), Google Veo (`veo-3.1-generate-preview`), xAI Imagine (`grok-imagine-video-1.5`), OpenRouter Video (`google/veo-3.1`, any OR video id), Seedance 2.0 (`seedance-2-0`). Per-service defaults store under `connection.defaultParameters.videoGeneration`; a connection can be flagged **"Default for Videos"**. Source of truth: `docs/SCENE_VIDEO_GENERATION.md`. **Local ComfyUI video generation** (v2.3.4, #3804) — API-format WAN and other workflows run as a local video backend with prompt, size, seed, frame-count, and uploaded first-frame placeholders, so the five cloud profiles are no longer the exhaustive list; an in-app and GitHub **ComfyUI workflow guide** (`docs/media/comfyui.md`, #3749) covers API-format exports, Marinara placeholders, local/RunPod reference images, character workflows, LAN, VRAM, and troubleshooting.
  - Per-service duration/aspect/resolution profiles (`video-generation-defaults.ts:25-54`): Gemini Omni 10s/16:9 (duration baked into the prompt; rejects `duration_seconds`), Veo 8s/16:9/720p (accepts only 4/6/8s; forces 8s with an image ref), xAI 10s/16:9/720p, OpenRouter 10s/16:9/720p, Seedance 5s/16:9/720p (opt-in `temporaryPublicReferenceUploadEnabled` + expiry 1h/12h/24h/72h, default 12h).
  - Advanced → Video Generation settings (key `video-generation`): `sceneVideoDurationSeconds`=10 (clamp 1–60s), `callCustomClipDurationSeconds`=5 (call clips clamp 1–15s), `animatedExpressionClipDurationSeconds`=3 (clamp 1–8s), per-kind `callClipDurations` all 5s; plus reusable prompt templates.
  - Env/config (troubleshooting): `VIDEO_GEN_TIMEOUT_MS` (default 30 min); poll intervals `GOOGLE_VEO`/`XAI`/`OPENROUTER`/`SEEDANCE_VIDEO_POLL_INTERVAL_MS` (10/5/10/10s); first/last-frame refs need public HTTPS via `VIDEO_REFERENCE_PUBLIC_BASE_URL` or per-connection temp-upload; remote downloads are HTTPS-only, validated as MP4.
- **TTS / voice (v2.1)** — a voice-provider union distinct from the LLM list: `openai | elevenlabs | pockettts | xai` (`tts.ts:4`). **xAI TTS** was added in v2.1 with built-in voice fallbacks (separate from the LLM `xai`/Grok provider). v2.3.4: **PocketTTS server voices** are directly selectable for global/character/narrator assignments — custom voice IDs/URLs/paths retained, new setups default to the compatible server endpoint (#3786) — and the TTS dialogue pause control now uses whole seconds 1–60, migrating legacy sub-second/no-pause values to the 1-second minimum (supersedes the 2.3.3 #3718 behavior).

## Special Features Worth Knowing

- **Conversation character schedules export/import (v2.4.0, #4414)** — validated JSON export and import for a character's Conversation schedule. Imports load as **unsaved drafts**, preserve the existing schedule until explicitly saved, and **move restored routines to the current week** rather than replaying stale dates.
- **Cross-chat awareness** — when the user mentions "yesterday," "last week," etc., the system retrieves relevant messages from the character's other chats and injects them as an `<awareness>` block. As of v2.3.4 (#3753), recalled memories, cross-chat awareness, connected Roleplay/Game context, and their command instructions honor the active Conversation preset's XML/Markdown/unwrapped format instead of hardcoded XML.
- **Semantic memory (message RAG)** — messages are chunked (5 at a time), embedded with `all-MiniLM-L6-v2` running locally, and retrieved by cosine similarity. Top 8 chunks with threshold filtering, toggle per-chat.
- **Regex scripts** — user-defined find/replace that runs on inputs and/or outputs, for formatting cleanup or custom macro systems.
- **Macros** — `{{char}}`, `{{user}}`, `{{time}}`, `{{date}}`, `{{random::a,b,c}}`, and more in prompts. New in v2.3.4: `{{group}}` lists every other active chat character (works during targeted Roleplay group generation; the full roster stays available in manual group generation), and conditional prompt macros gained `||` (OR), `&&` (AND), parentheses, and equality-list shorthand.
- **Connected chats** — conversation ↔ roleplay bidirectional links with `<influence>` (conversation → RP) and `<ooc>` (RP → conversation) tags. Game Mode also supports a connected-chat shortcut (v2.2) so a connected Conversation and Game chat can switch back and forth like the Conversation/Roleplay links. The Cross-Chat Awareness settings now live under **Connected Chats** (v2.3.4, #3889).
- **Spotify integration** — the **Music DJ** agent (a downloadable package, id `spotify` — see Downloadable Agents (v2.3)) can control playback via its tools (`spotify_play`, `spotify_search`, etc.) to score the scene; the always-available Music Player toggle shows "Download Music DJ Agent to configure" guidance when the package isn't installed.
- **Discord webhook mirror** — per-chat Discord webhook that mirrors user and AI messages.
- **Haptics / Love Toys** — the `haptic` agent ("Haptic Feedback") drives devices via Intiface Central (Buttplug protocol) running locally (yes, really; it's in the README).
- **Slash commands** — client-parsed `/`-commands (`slash-commands.ts`). Notably **`/illustrate`** (alias `/ill`) in Conversation, Roleplay, and Game chats triggers the same illustration action as the Gallery Illustrate button without opening the Gallery (v2.1; 30-min timeout `ILLUSTRATE_SLASH_TIMEOUT_MS`).
- **In-app Documentation viewer (v2.1)** — the `docs/` guides are browsable inside Marinara via a **Documentation** button in the home-page footer (next to Replay Tutorial); a FAQ entry shows the on-disk docs path. Support/ideation answers can point users to the bundled docs in-app.
- **What's New window (v2.3)** — a one-time, version-aware What's New window (post-onboarding, Mari-hosted) links the GitHub release and remembers the shown version.
- **Generation-completion notifications (v2.3)** — opt-in browser/Android notifications for manually started replies that finish while the app is unfocused (#3588).
- **New env vars (v2.3, #3730)** — `CHAT_GENERATION_TIMEOUT_MS` for slow Conversation/Roleplay/Game providers, and `AUTO_UPDATE_ENABLED=false` for a persistent launcher update opt-out (Windows/macOS/Linux/Termux) without disabling manual updates. As of v2.3.4, with auto-update disabled the launchers do a read-only latest-release check and print a console reminder (installed version + release link), and `--skip-update` suppresses checks for one launch; macOS/Linux/Termux launchers also no longer source `.env` as Bash — Node's non-evaluating dotenv parser is used, with ambient-environment precedence preserved (#3810).
- **Env vars added since (2.3.5 / 2.4.0)** — `AGENT_CALL_TIMEOUT_MS` (10s–1h, default 5 min; total-duration cap on one agent LLM call, applied even mid-stream — Illustrator keeps its own 30-minute floor). `GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS` (10s–1h, default 45s; the Game scene → image prompt call). `TRUSTED_HOSTS` (extra public/reverse-proxy hostnames; direct IP, localhost, `.local`, `.home.arpa`, and single-label LAN names already work — this backs the 2.3.5 DNS-rebinding guard that rejects untrusted Host names *before* CORS, loopback auth bypasses, or privileged reads). `REQUIRE_AUTH_FOR_DOCKER_PROXY` (default **`true`** as of 2.4.0; `false` is an explicit legacy opt-out for fully trusted upstream clients — direct same-host Docker bridge/gateway traffic still works via `BYPASS_AUTH_DOCKER`). `ENABLE_EXTERNAL_EXTENSIONS` (first of two gates for third-party extension imports). `DOCS_I18N_BASE_URL` (documentation pack source). Also *(2.4.0)*: `CHAT_GENERATION_TIMEOUT_MS` now governs the **time-to-first-byte budget for background generation** too (Noodle timeline refresh, Noodler replies), fixing `HeadersTimeoutError` / "fetch failed" on slow local models after a fixed five minutes (#4174).
- **Noodle changes (v2.4.0)** — Noodle and NoodleR switch to their **mobile layouts whenever the center pane drops below desktop width**, including when sidebars squeeze it on a desktop machine (so it's not a phone-only behavior). (#4056) **Public Noodle handles are now case-insensitively unique across Personas and Characters**, with deterministic suffixes for auto-created profiles and reconciliation of older collisions — this is why a handle may come back auto-suffixed, which users read as a bug. (#4310) Corrupt or undecodable timeline images are skipped before captioning and multimodal generation, so a refresh continues with text instead of forwarding invalid bytes.
- **Chat sort default changed (v2.4.0, #4341)** — **Recent** is now the default chat sort, ordered by *last-message activity*. **Newest** and **Oldest** now sort by *chat creation date*. If a user says their chat list "reordered itself" after upgrading, this is why.
- **Automatic backups (v2.4.0)** — rotating daily / weekly / monthly full backups under **Settings → Advanced → Backup & Export**, with last-run and failure state shown in the UI.

### Localization — two separate settings, don't conflate them (v2.3.5 / v2.4.0)

Marinara has **two independent language controls**, and confusing them is an easy support mistake:

**1. Interface language** (*v2.3.5*) — **Settings → General → App Behavior → Language**. Localizes application UI text only: controls, labels, guidance. It does **not** touch model prompts, authored content, or chat messages. English (`en.json`) is canonical and the runtime fallback, so a missing translation shows English rather than a key or an empty control. Locale JSON files are discovered lazily; the selection also propagates into downloadable Agent interfaces.

Twelve locales: Arabic (**right-to-left**), Simplified Chinese, English, French, German, Hindi, Japanese, Korean, Polish, Brazilian Portuguese, Russian, Spanish. *(v2.4.0)* Native language names in the dropdown are capitalized (Español, Français, Polski, Português (Brasil), Русский).

**2. Documentation Language** (*v2.4.0*) — **Settings → General → Documentation Language**, also offered at the end of the first-time tutorial. Controls the language of the **in-app guides**, which ship as **downloadable packs** from the repo's `docs-i18n` branch.

- **Download & Replace** fetches the selected language into the data folder with per-file integrity verification and live progress, then **removes the previous pack** — installs carry exactly one language, checkouts carry none.
- Untranslated guides open in English with an **`EN` badge**. In-app docs search works in the active language.
- The choice survives every update path; the first start after an update auto-refreshes the pack when its translations changed.
- A **Fix documentation** failsafe verifies, re-downloads, or resets a broken pack, and reports what actually happened rather than always claiming a reset.
- Packs available at 2.4.0: Spanish, German, French, Brazilian Portuguese, Polish, Russian, Japanese, Korean, Simplified Chinese — each covering all ~123–124 guides including developer docs.
- **UI control names stay in English inside translated guides**, deliberately, so instructions can be followed against the interface. (Korean glosses them against the shipped Korean UI strings where one exists.)
- Forks and mirrors can point **`DOCS_I18N_BASE_URL`** at their own copy of the `docs-i18n` branch (must be a public `https://` host).
- The tutorial's language suggestion matches region-suffixed locales, so a `pt-BR` interface proposes the pt-br guides on first run.

*Contributor note:* changing an English guide obliges keeping every language pack on `docs-i18n` in step — this is in the contributor docs, and `pnpm check` includes localization gates. See `docs/development/localization.md`.

- **Home New Chat launcher (v2.4.0, #4058)** — a compact **New Chat** entry on Home that explains Conversation, Roleplay, and Game *before* opening the selected mode's existing setup wizard. Mode choice is now surfaced up front, which matters for first-run guidance.
- **Android status bar (v2.3.5)** — an Android-only **Show Android status bar** control under **Settings > General > App Behavior**. Fullscreen stays the default; enabling it makes the Android app remember and restore the clock, battery level, and notification icons across restarts.
- **Game character-sheet Retry (v2.4.0, #4048)** — regenerates only the selected Persona or party member from their card and the current campaign history, keeping the result as an **unsaved draft** and preserving the original sheet unless saved. Note the recurring engine convention: schedule imports, card version restores, and this all land as *drafts* pending explicit save.
- **Settings reorg (v2.2)** — Settings gained search-first navigation with compact pinned controls and fixed top-level categories. Media-wide queueing and prompt-review controls moved into a new **Overall Generations** group; the queue option was renamed **Queue media generation requests** and now also covers video. Image prompt review is a global preference, and **Quick replies** moved from Advanced to **General → Input & Editing**.

## What's NOT Built-In

Important for recommendations:
- No native external vector DB integration (lorebook uses local embeddings only).
- No *unrestricted* client extension mechanism. The old full-trust CSS/JS feature was removed in v2.3.4; **v2.3.5 reintroduced sandboxed Personal Extensions** (see `references/extensions.md`). What's genuinely absent is ambient authority: a sandboxed extension cannot reach messages, presets, lorebooks, undeclared card fields, chat metadata, the DOM, the database, or the network. Those need a broker capability in the engine, the un-sandboxed Full page access path (External Extensions, double-gated), or a fork. Server Extensions are unavailable on Windows and Android.
- No third-party plugin marketplace — official capability packages install from the in-app **Download Agents** catalog (v2.3; auto-updating, per-major lanes); as of v2.3.4, disabled-by-default **custom GitHub agent repositories** (#3861) add an opt-in third-party install path.
- No hooks into the prompt assembly pipeline — can't insert your own logic mid-generation without forking.
- No multi-user auth — it's single-user / local-first by design. Multi-user requires a proxy + auth layer you build.
- Script tools have no network, no filesystem, no `require`. Pure JS computation only.
- No built-in way to add new chat modes.
- No native GraphQL, no tRPC, no realtime subscriptions beyond SSE for generation.

If the user needs any of these, the answer is usually "webhook tool to your own backend" or "fork the engine."
