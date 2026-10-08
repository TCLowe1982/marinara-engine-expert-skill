# Agents

Agents are **autonomous LLM sub-systems that run during message generation**. They handle side tasks like state tracking, prose quality enforcement, continuity checking, image generation, and music control — running before, alongside, or after the main response.

*(v2.3)* Official agents are **downloadable packages, not built-ins** — a fresh install ships **zero optional agents**. The model is two-step: **install** a package from Agents → Download Agents, then **enable** it per chat. Each enabled agent adds latency and token cost per turn, so the right recommendation is usually the minimum viable set — and any recommendation that relies on an official agent must include the install step.

**Source of truth:** Engine runtime — `packages/server/src/services/agents/` (agent-executor.ts, agent-pipeline.ts), `packages/shared/src/schemas/agent.schema.ts`, `packages/shared/src/types/agent.ts`, `packages/shared/src/constants/agent-prompts.ts` (default prompt templates for official agents). *(v2.3)* Packaged-agent feature code lives in **`Pasta-Devs/Marinara-Agents`** (`packages/<id>/`); upstream reference docs: `docs/agents/built-in-agents.md` (per-package guide), `docs/agents/custom-agents.md`, and for package authors `docs/development/optional-agent-packages.md`. *(v2.3.4)* The contract cleanup removed the obsolete generated registries — `agent-registry.generated.ts` no longer exists; don't cite it — along with unused agent/turn-game contract members, duplicate tool arrays, Visual Novel types, and chat-mode definitions (legacy downloadable-agent package parsing is preserved). The empty `BUILT_IN_AGENTS` array now lives in `packages/shared/src/types/agent.ts`, populated at runtime from installed package manifests; `BUILT_IN_AGENT_IDS` (21 legacy/compatibility ids) and `RETIRED_BUILT_IN_AGENT_IDS` survive there. `BuiltInAgentMeta` carries `category` (`'writer' | 'tracker' | 'misc'`) and `execution` (`'pipeline' | 'feature' | 'host'`) fields.

## Agent Phases

An agent runs in one of three phases, which determine when it fires relative to the main response generation:

### `pre_generation`
Runs **before** the main model is called. Can inject context, review the prompt, or rewrite directives that will be included in generation.

**Good for:**
- Context injection (semantic lorebook retrieval, knowledge sources)
- Prompt review and quality scoring
- Prose directives ("use these devices this turn, avoid these words")
- Scheduling (generating character schedules for conversation mode)
- Narrative pacing directives (Director-style injections)
- Choosing which attached characters reply this turn (`manage_chat_characters`, see capabilities)

**Cost:** Adds latency to every turn before the user sees the response starting.

### `parallel`
Runs **at the same time as** the main model. Doesn't block the main response.

**Good for:**
- Image generation based on the current scene
- Music/Spotify suggestions
- Echo messages (absent characters reacting to the current scene)
- Combat mechanics that are computed separately from narration
- Autonomous messaging triggers in conversation mode

**Cost:** Token cost adds up but doesn't delay user-visible output.

### `post_processing`
Runs **after** the main model finishes. Receives the generated message and can extract, update, or even rewrite it.

**Good for:**
- State extraction (world state, character status, quest progress)
- Continuity checking and correction
- Sprite/expression picking based on emotional content
- Background selection based on scene
- Copy-editing and grammar passes
- Rolling summaries for long chats
- Auto-generating lorebook entries from the story

**Cost:** Adds latency after generation finishes but before results fully settle. *(v2.4.3, #5155)* In Roleplay, Swipe, Continue and the composer are released as soon as the reply is saved; **non-rewriting** post-processing agents finish in the background against that exact message and swipe. Rewrite agents (Prose Guardian, Continuity Checker, Immersive HTML, custom Text Rewrite) still finish first — the built-ins have a **Hold Message Until Rewrite** toggle that hides the reply until the rewrite lands.

## Downloadable Agents (v2.3)

v2.3.0 moved every optional agent out of the base Engine into **downloadable capability packages** (25,000+ lines of agent/map/call/table-game code removed from the Engine). Fresh installs contain **no** optional agents; existing installs migrate selections, settings, and history automatically.

### The Download Agents library

**Agents → Download Agents** is a full-page library for official packages: install, read about (description, feature type, download size, permissions, version compatibility, docs), update, and uninstall each one, with creator artwork (star fallback when art is missing). **Install All / Uninstall All** run through a safe sequential queue. *(v2.5.0, #6943)* Packages are grouped **Apps** (packages that open their own **Home** tab — Noodle, Slurp, Gacha Forge; each asks for a restart after install) / **Writer Agents** / **Tracker Agents** / **Misc Agents**; before 2.5.0 the Apps sat inside Misc and the order was Writer, Tracker, Misc. A package marked **Rules** adds a Game Mode ruleset, not an agent — nothing to switch on in a chat (→ `rulesets.md`). *(2.3.2)* Each package shows **Conversation / Roleplay / Game compatibility badges**, and the catalog is searchable by mode (#3676). *(v2.3.4)* The official catalog is no longer the only source — see **Custom GitHub agent repositories** below.

### Package catalog

First-party packages are published in **github.com/Pasta-Devs/Marinara-Agents** as individually verified packages — **39 on the stable catalog at the v2.5.0 sync** (`catalog/v3/catalog.json`): by catalog category **6 Writer, 13 Tracker, 20 Misc** (the UI pulls the Apps out of Misc). The catalog changes independently of Engine releases, so check Download Agents (or ask Professor Mari) for the live list; older counts (31 at 2.4.0, 32 at 2.4.2, 36 at 2.4.6) are history. Staging-only previews — the **5e (SRD 5.1)** ruleset (`ruleset-5e-2014`) and **Modern Life Sim** — appear only on a `staging`-branch Engine. Trust model: schema validation, SHA-256 checksums, per-file hash/size checks, atomic install, and offline availability once installed; *(v2.4.2)* installs and updates are bound to the exact version and checksum the user reviewed. Professor Mari's prompts carry a catalog summary, so she can compare and recommend packages in-app. Upstream reference doc: `docs/agents/built-in-agents.md` in the Engine repo.

*(2.3.3)* Each Engine major installs/updates only from its matching **catalog lane** — `catalog/v2/catalog.json` for Engine 2, `catalog/v3/` for Engine 3, with `catalog/catalog.json` as a legacy v2 alias (#3712).

*(2.3.5)* Two security changes to package distribution:
- **Updates now prompt per version.** Silent startup updates for installed packages were replaced with a responsive per-version confirmation. Choosing **No** records that decision without changing the installed package; the manual **Update** action stays available in Agents → Download Agents. (2.4.0 corrected Mari's guidance to match this user-confirmed flow.) *(v2.4.6)* The **Agent updates available** window lists each update's new version, whether it needs a restart, and — when the publisher ships `notes.json` — a collapsible **What changed** (a dot marks a noticeable change); **Not now** never re-asks about a skipped version, and Download Agents gains a **Version history** section.
- Official catalog artifacts are **restricted to canonical Marinara-Agents repository URLs**, while explicit custom-catalog overrides are preserved.

### Custom GitHub agent repositories (v2.3.4)

The Agents Manager can also install packages from **custom GitHub agent repositories** — a third-party agent-source path alongside the official catalog (#3861). **Disabled by default.** To turn it on: set `ENABLE_CUSTOM_AGENT_REPOS=true` on the server, enable **Settings → Advanced → Danger Zone → Allow custom Agent imports**, then open **Agents → Download Agents → Custom Sources** (`docs/CONFIGURATION.md`). Key properties: updates are **manual preview/apply** (no auto-sync), each repository requires an **explicit per-repo trust confirmation**, sync identity is stable, and archive validation is bounded and SSRF-safe. *(v2.5.0)* A repository may carry agents (`agents.json`), Game Mode rulesets (a top-level `rulesets/` folder), or both — rulesets → `rulesets.md`. This is the supported way to distribute third-party packages outside the official catalog.

### Package lifecycle

- *(2.3.1)* Installed packages check the catalog at **server startup** and auto-upgrade to the newest compatible version before their runtimes activate (the auto-upgrade was replaced in 2.3.5 by the per-version prompt above). Offline, incompatible, missing, or failed updates keep the previous version; a verified runtime failure rolls back automatically.
- *(2.3.2)* Catalog HTTP failures report real status, and installed agents keep working offline (#3706/#3707).
- *(2.3.3)* Incompatible package versions are **quarantined** before their hooks can crash generation (#3647).
- *(v2.4.4, #5285)* For "restart Marinara Engine" prompts, **Restart Server** in the Advanced settings closes storage and services gracefully and relaunches.

### Enable Agents master toggle

Each chat has an **Enable Agents** master switch gating all agent initialization and model calls: with it off, no selected agent — including package services — initializes or calls a model. The setting survives the v2.3 capability migration without needing to be re-enabled (#3669). *(2.3.3)* World Maps fully obeys it (UI, prompt generation, lorebook previews, retries, tracker patches, carryover, checkpoints). Advanced Memory Recall is the exception — it's a built-in memory mode, not an agent, and runs regardless (see the memory surfaces below).

### Capability API (packages)

Packages started on **capability API 1.3** (v2.3.2, #3690); the host is at **Capability API 1.66 (v2.5.0)** (`supportedCapabilityApi`, `packages/shared/src/schemas/capability-package.schema.ts`). A package declares the highest minor any feature it uses needs, and an older Engine refuses the install cleanly. Package kinds: `agent`, `maps`, `conversation-calls`, `turn-game`, `ruleset`. Permissions: `achievements`, `agent-runtime`, `chat-read`, `chat-write`, `conversation-actions`, `mari-actions`, `network`, `prompt-context`, `routes`, `scenes`, `storage`, `tools`, `ui` — *(v2.4.6, #5899)* chat and spatial persistence (including transactions) needs declared `chat-read`/`chat-write`. The base Engine keeps validated capability registries and compatibility bridges; capability-owned tables resolve via registered schema names (#3647). Steps worth knowing:

- *(v2.4.1, #4526)* **`prompt-context` packages contribute text to each turn's system prompt.** This qualifies "you can't hook prompt assembly without forking": arbitrary user code still can't, but a reviewed package can. *(1.14)* Roleplay tracker / Tracker Panel views and package-aware prompt placement through preset Agent sections — what Memory Nag uses.
- **Game-surface Experiences** (1.8+, `game-surface` slot): a package provides an *entire* Game mode — its own HUD, menus and combat over the shared narration — chosen at game creation from the wizard's **Experiences** block, fixed for that game, declaring which built-in systems it replaces (anything undeclared stays built-in). Follow-ups: 1.11 combat seam, 1.13 cutscene narration collapse, 1.16 Game Master verbs (`gm-verbs.json`, needs `chat-write`), 1.17 world prep before the opening turn, 1.18 inline setup and seed in the wizard. An Experience is code; a ruleset is data under the standard Game UI → `rulesets.md`.
- 1.10 package assets (`contributions.assets.paths`, served hash-verified — tilesets, sprite atlases); 1.15 `runtime.resolveEmbeddings()` (*(v2.4.2, #4745)* packages use the embedding source configured on their agent connection, local MiniLM only as fallback); 1.19 package-contributed tools (`tools`); 1.20+ Game Mode rulesets (→ `rulesets.md`); **1.31 host LLM, image and video integrations** (packages inherit the Engine's provider fixes, queues and safeguards instead of bundling copies); 1.35 up to three Home widgets; 1.36 achievements.
- **1.50 Professor Mari actions:** a package with `mari-actions` can offer actions that Mari lists and runs through her `package_service` tool; the package validates inputs and Mari's Permissions Mode still applies (v2.5.0, #6799).
- **1.66 scene origins:** `api.registerSceneOrigin` plus the `scenes` permission let a package thread (e.g. a direct-message thread in a social App) start a Roleplay scene the way `/scene` does from a Conversation; **Back** returns to the thread, and on request the thread stays locked during the scene and receives the recap (v2.5.0, #7118).

Per-version notes: `docs/development/optional-agent-packages.md`. Relevant if you're authoring or debugging a package rather than a plain custom agent.

### Upgrading to v2.3

Upgrades from ≤2.2 migrate agents and chat feature selections without losing settings, data, or history; the migration is restart-safe and idempotent (#3670). Known bug: the 2.3.2 migration auto-selected Hierarchical Maps everywhere — 2.3.3 ships a one-time correction (#3723).

## Official Downloadable Agents

These were the "built-in agents" through v2.2; *(v2.3)* they are now the **official catalog** described above (39 stable packages at the v2.5.0 sync). None are present on a fresh install — install from Download Agents first, then enable per chat. Pipeline packages are listed by phase, with the `id` you reference in config, the display name, and the catalog category (**Writer / Tracker / Misc**); feature packages (package-owned runtimes, `execution: "feature"`) and the Apps follow in their own subsections.

> **Retired — don't reference these:** `prompt-reviewer`, `response-orchestrator`, `schedule-planner`, `chat-summary`, `autonomous-messenger`, `youtube`, `secret-plot-driver`, and *(v2.3)* `about-me-keeper` are in `RETIRED_BUILT_IN_AGENT_IDS` and are neither built-ins nor packages. (Chat summary survives only as a prompt constant, not an agent. Conversation's **About Me** profile and the `update_about_me` tool remain built into the Engine — they are **not** downloadable agents — and as of 2.3.2 About Me drafting goes through Professor Mari.)

### Pre-generation
- **`director`** (Narrative Director — Writer) — pacing directives, dramatic beats, scene transitions. *(v2.3.5)* **Story Push Mode moved.** The Natural/Random progression choice is no longer in Chat Settings → Agents → Narrative Director, the add-agent setup, or the editor's Story Push Mode default — clicking **Push Story** now opens a Naturally/Randomly selector that arms the chosen mode for the **next response only**. It's per-chat state (`narrativeDirectorMode` in `chat.schema.ts`), which is exactly why the old global control was removed. Any click-path advice pointing at the old location is stale. *(v2.4.0)* Its Secret Plot maintenance is included in the Run Interval change below.
- **`knowledge-retrieval`** (Knowledge Retrieval — Writer) — a model **summary pass** over the lorebooks you pick (**Use chat-active lorebooks** / **Fixed Source Lorebooks**) and uploaded files: it summarizes what matters and injects that summary; no separate database, and not embedding search (earlier guidance called it embedding-based). Roleplay only (`docs/agents/knowledge-sources.md`).
- **`knowledge-router`** (Knowledge Router — Writer) — lower-cost alternative: reads entries' short descriptions, selects relevant entries by ID and injects them verbatim (works best when entries have good descriptions). Roleplay only. Don't run it alongside Knowledge Retrieval — they overlap.

### Parallel
- **`echo-chamber`** (Echo Chamber — Misc) — absent characters / sidebar reactions to the current scene. *(v2.1)* Fires only on fresh user messages; it does **not** trigger on `/continue` continuation rewrites.
- **`combat`** (Combat — Misc) — turn-based combat mechanics computed alongside narration.

### Post-processing
- **`prose-guardian`** (Prose Guardian — Writer) — repetition analysis, rhetorical-device selection, sentence variety, sensory rotation. *Defaults to post_processing (phase overridable — see below).*
- **`continuity`** (Continuity Checker — Writer) — flags/repairs contradictions with established lore. *Defaults to post_processing (phase overridable — see below).*
- **`html`** (Immersive HTML — Misc) — adds in-world HTML/CSS visuals (a styled note, a screen) to the latest Roleplay reply without changing the story. It's a post-processing **rewrite** agent sharing one rewrite call with Prose Guardian and Continuity Checker (#3094; earlier guidance described it as a pre-generation prompt injection — it isn't one any more).
- **`world-state`** (World State — Tracker) — tracks date/time, weather, location, and present characters. *(v2.2)* No longer a fixed built-in field set: users can add **custom fields** and toggle **per-field hide** controls, with inline editing and lock-aware persistence, surfaced in both the Tracker Panel and Roleplay HUD (#3518).
- **`character-tracker`** (Character Tracker — Tracker) — present characters, moods, relationships, appearance/outfit, stats. *(v2.2)* Also supports user-defined **custom fields** and per-field hide/lock like World State. Stat values may be **structured objects** — `{ name, value, max, color }` (e.g. HP/MP bars), normalized by `rpg-stats` — not just plain numbers/strings; the Present Characters tracker now renders these safely instead of crashing (#3563). *(v2.4.6, #6104)* **Multi-character cards:** mark each cast member in the card text with a `[CHARACTER: Name]` header or a `Name:` field and members are tracked separately (own name, state, portrait) instead of collapsing into one entry named after the card (→ `character-cards.md`).
- **`custom-tracker`** (Custom Tracker — Tracker) — user-defined tracking (any JSON state).

> *(v2.4.0)* **Radial-gauge stat layout** — Persona and Character tracker stats can optionally render as radial gauges with editable icons, percentage readouts, and subtle low-stat warnings (plus improved featured-card spacing and thought placement). It builds on the structured `{ name, value, max, color }` stat shape described under Character Tracker, so stats already using that shape get gauges for free. Also: **tracker panels now appear as soon as their matching tracker agents are active**, so starting values can be entered *before* the agent's first run — useful for seeding state instead of letting the model invent turn-one values.
- **`persona-stats`** (Persona Stats — Tracker) — updates player/character RPG stats. Stat pools use the structured `{ name, value, max, color }` shape (see Character Tracker).
- **`quest`** (Quest Tracker — Tracker) — quest objectives, completion, rewards.
- **`inventory-tracker`** (Inventory Tracker — Tracker) — *(v2.4.3, #5105)* money, equipped gear and carried items as three structured lists (result type `inventory_tracker_update`), editable and lockable per cell in the HUD and Tracker Panel; **Add as Prompt Section** on by default. When it's active, Persona Stats no longer owns inventory (#5450).
- **`beholder`** (Beholder — Tracker) — *(v2.4.3, #5188)* Roleplay-only physical state: clothing by body slot, held items, wounds, missing parts, bare slots, species; its validated snapshot feeds both its next call and the next main reply. Configure under Chat Settings → Agents → Tracker Agents → **Configure Beholder**, and pick the template that matches the model: **SOTA model — one prompt** (default) or **Beholder local model — five passes** for the purpose-trained local extractor. Always runs in its own request.
- **`quartermaster`** (Quartermaster — Tracker) — *(stable at v2.5.0, #7146; Engine 2.4.6+)* the **active persona's** inventory, equipment slots, quantities, storage locations and saved outfits, edited through a floating dock above the Tracker Panel: equip/store, restore inventory or revert recent tracker changes, export/import a chat's setup. Optional item art (its own image connection), appearance macro and avatar replacement. Persona only — not party members or NPCs. Restart after install.
- **`relationship-tracker`** (Relationship Tracker — Tracker) — *(stable at v2.5.0, #7146; Engine 2.4.4+)* an editable relationship web for a Roleplay **group** chat's cards plus each card's view of the persona (positive / neutral / negative / complicated), shown in the Tracker Panel. Choose **All relationships** or **Scene-only relationships** once to initialize; **Update from History** runs a bounded scan; manual edits lock (**Resume automatic updates** releases them); **Context Size** default 5, **Presence lookback** default 15. Restart after install.
- **`memory-nag`** (Memory Nag — Tracker) — *(v2.4.4, #5408)* a Roleplay-only per-chat **memory vault**: it scans the transcript in checkpointed batches into short per-character memories (promises, unfinished goals, injuries, admissions…), with a restorable **Resolved** list. After each reply, deterministic word matching shortlists relevant active memories and the tracker decides whether the moment calls for a "nag" — it can't invent memories during recall. Setup: add it, open **Chat Settings → Agents → Memory Nag**, set its connection, and run the initial scan. Defaults: vault-scan connection = the Agent connection, 20 messages per batch, at most 10 memories created / 5 considered per character, 3 injected. Without a preset marker, nags enter the next reply as `<context><memory_nags>…</memory_nags></context>`; a Memory Nag Agent preset section places them explicitly. The vault survives disable/uninstall. Restart after install.
- **`expression`** (Expression Engine — Tracker) — picks character sprite expressions from emotional content. *(v2.1)* Expression portrait sprites can also be produced as short **video** clips via a Video Generation connection and converted to looping GIFs, then saved into expression slots (Advanced > Video Generation sets duration/prompt; `animatedExpressionClipDurationSeconds` default 3s). See character-cards.md / architecture.md for the media path.
- **`background`** (Background — Tracker) — picks the scene background image. *(v2.3.4)* **Selection-only:** the agent's image-generation toggle and runtime were removed — it now only selects from existing library backgrounds; automatic and Gallery background *generation* belong to Illustrator (see the `illustrator` entry). *(v2.1)* In Game Mode, a manually selected chat background now overrides automatic GM scene-background selection until the user removes it (mirrors the tracker field-lock "manual pin wins" pattern).
- **`illustrator`** (Illustrator — Misc) — generates scene illustrations via an image provider (default `runInterval: 5`; *(v2.4.6)* **Run Interval 0** = manual-only — Gallery actions stay, automatic runs stop; *(v2.4.6, #6020)* enabling Roleplay illustration commands no longer suspends the automatic interval, so character-requested images come on top). *(v2.4.0, #4057)* **Per-chat image-connection override:** Chat Settings can point Illustrator at a *different connection for rendering the image* than the one writing the prompt, falling back to the Illustrator Agent's configured image model. Two connections, two jobs — say which is which when advising. *(v2.3.5, #3966)* **Images Per Generation** is a per-chat setting producing up to **four sequential variants** through the existing provider queue and gallery pipeline; raising it multiplies image spend per trigger, so name it in cost advice. Generated image attachments were also enlarged in Conversation and Roleplay while staying inside the chat viewport. *(v2.3.4)* **Owns background generation:** automatic and Gallery background generation run through Illustrator's background prompt mode — the Gallery Background action routes through it (#3809), and results apply to the active Roleplay chat rather than being attached as ordinary illustrations. (The Background agent only *selects* existing backgrounds — see the `background` entry.) *(v2.3)* Install-gated: until the Illustrator package is installed, `/illustrate` and `/selfie` are hidden, image/video generation settings are hidden, and the Gallery Illustrate/Selfie/Storyboard/Video/Animate/Background actions are unavailable in every mode. (The v2.3 guidance also required enabling it per chat; *(v2.5.0, #6874)* Roleplay's Gallery and `/illustrate` now make a one-off illustration with the installed Illustrator without enabling automatic agents or changing chat settings.) Renames: selfie configuration is now **"Illustrator Settings"** (Chat Settings > Agents), the Connections defaults category "Illustrator" is now **"Images"**, and Game setup's "Visual Generation" is now Illustrator. *(v2.2)* The default Illustrator prompt rules were updated to carry available character **build, clothing/outfit, and appearance** details into the generated image prompt instead of leaving the image model to infer them. *(v2.1)* Distinct from the optional **Game Illustrator** "Dynamic LLM Prompt Generation" toggle (per-chat `gameImageDynamicPromptEnabled`; UI: Chat Settings > Agents > Illustrator), which asks the chat/prompt LLM to rewrite Game Mode NPC-portrait, location-background, and key-moment illustration prompts before image gen. GM-created NPC profile descriptions are rebuilt from current game state at asset-send time and sent as required canonical visual guidance for portrait prompts (preserved when generated avatars are written back to NPC metadata).
- **`lorebook-keeper`** (Lorebook Keeper — Misc) — auto-writes lorebook entries from the ongoing story (default every 8 messages). *(v2.4.6, #5907)* An explicitly selected **Target Lorebook** is respected in automatic runs, retries and approval; *(v2.4.4, Marinara-Agents#439)* advanced prompts can route entries to exact writable book names or aliases (`world`, `npc`, `scene`, `player`), creating and linking missing alias books. Always runs in its own request.
- **`card-evolution-auditor`** (Card Evolution Auditor — Writer) — proposes character-card edits for user approval.
- **`spotify`** (Music DJ — Misc) — plays scene-matched music through **Spotify, YouTube, or local Game Assets** (`musicProvider` setting; *(v2.3)* Game Assets is the third source). *(v2.4.4, #5262)* The compact music player stays hidden, and its General Settings switch is unavailable with an explanation, until Music DJ is installed; installing unlocks both (earlier guidance described an always-available toggle). Local/Game-Assets configuration lives in four settings keys (`agent-executor.ts`): `customMusicFolder`, `customMusicExternalFolder`, `localMusicFolder`, `localMusicExternalFolder`. *(v2.3.4)* The shared recent-track history now covers the last **250 Spotify tracks**, so 50-song candidate batches rotate across large playlists instead of repeating.
- **`cyoa`** (CYOA Choices — Misc) — generates in-character choices after a response. *(v2.4.0)* Choices gained a **Post/Impersonate quick toggle**, and centered choices now stay clear of the Tracker panel.
- **`haptic`** (Haptic Feedback — Misc) — drives haptic devices via Intiface Central running locally. *(v2.4.3)* Works in Conversation, Roleplay and Game with the full `0.0–1.0` intensity range, every Intiface output type and named patterns; **Touch Sensitivity** (Subtle / Standard / Intense) guides choices without capping intensity.

> *(v2.3.5, #3960)* **Local Sidecar on demand.** An agent *explicitly assigned* to the Local Sidecar can start that runtime on demand even when the global tracker-sidecar default is disabled. If a user reports "my sidecar agent runs even though I turned the sidecar off," that's intended behavior for an explicit per-agent assignment — not a bug.
- **`storyboard`** (Storyboard — Misc) — *(new to the catalog by v2.4.0)* multi-panel scene storyboards (still or animated) for Roleplay and Game. *(v2.4.6, #6165)* More than six frames are accepted, up to the 200-section request ceiling.

> **Storyboard vs. Animate — not interchangeable.** *(v2.4.0, #4311)* Roleplay Gallery **Animate** gained a **single-shot animation director**: the selected Prompt Model plans motion, camera behavior, supported dialogue, sound effects, ambience, and an ending hold, derived from the exchange behind the Illustrator image. The existing image stays as frame zero. Its duration-aware instructions are editable under **Settings → Generations → Video Generation Prompt Overrides**, with a `${durationSeconds}` placeholder. **Game Storyboard behavior did not change.** So: Animate = one model-directed clip from one image; Storyboard = multi-panel keyframes. Recommending one when the user wants the other is a common mix-up.

### Feature packages (not pipeline agents)

These catalog packages ship package-owned server runtimes and surfaces instead of running as a phase in the agent pipeline (`execution: "feature"`):

- **`hierarchical-maps`** (World Maps — Tracker; package id unchanged) — *(v2.3)* nested world maps for Roleplay and Game; enableable in Roleplay and during/after Game creation. *(v2.5.0, Marinara-Agents#1132)* Holds up to **5,000 locations** (was 500). Install/removal needs a restart. *(v2.4.0)* **Navigation moved:** its dedicated launchers were removed from the Chats sidebar and top bar — World Maps is now reached only from the **Agents** tab and **Chat Settings**. Click-path advice saying "open World Maps from the sidebar" is stale. Its controls live nested inside its **Chat Settings > Agents** entry (#3679). *(2.3.3)* Fully obeys the Enable Agents master toggle; incompatible 1.0.x runtimes are quarantined (fixes "t.select is not a function"); a one-time correction removes the 2.3.2 migration's accidental Maps auto-selection (#3723); Maps calls in inactive chats no longer block sends ("Failed to flush 1 game-state patch callback").
- **`long-term-memory`** (Long-Term Memory — Misc) — *(new to the catalog by v2.4.0)* durable cross-session recall: extracts memories from chat summaries, character records and lorebooks into a package-owned vault and recalls relevant ones **before** the main reply (Conversation, Roleplay, Game). Its output reaches a custom agent only if that agent has the **`recalledMemories`** context source enabled (see "Per-agent context sources" below). *(v2.4.0)* Memory Recall discards superseded message revisions and injects only the current edited message text (#4304). Install/update/removal needs a restart; uninstalling keeps the vault.
- **`conversation-calls`** (Calls — Misc) — audio/video calls, moved into a package in v2.3.0 and renamed **"Calls"** user-facing in 2.3.2 (#3676; package IDs preserved). **Owns Local Whisper**: Connections shows the Local Speech Model controls only while the package is installed, and uninstalling removes downloaded Whisper models. #3671 fixed Whisper discovery when `DATA_DIR` is unset; package v1.0.4 stopped hardcoded fallback replies and dropped the provider-native JSON mode requirement (#3685). *(v2.3.4)* After a successful Local Whisper download, a notice asks you to **completely restart Marinara Engine** before use.
- **Six table games** (all Misc) — **`uno`** (UNO), **`chess`** (Chess), **`poker`** (Poker), **`eightball`** (8-Ball Pool), **`tic-tac-toe`** (Tic-Tac-Toe), **`rock-paper-scissors`** (Rock-Paper-Scissors) — Conversation feature packages with package-owned runtimes. They surface as **Commands toggles**, not Add Agent entries (no legacy `activeAgentIds`). *(2.3.2, #3699)* Installed games hot-activate their slash commands without an Engine restart; route-bearing packages keep a safe restart path. At v2.5.0 each game package is marked `restartRequired` and the docs say install/removal needs a restart — follow the in-app prompt.

#### Apps (own Home tab)

*(v2.5.0, #6943)* Packages that open in their own **Home** tab and are used on their own rather than added to a chat. Install from **Agents → Download Agents**, **restart when prompted**, then open **Home → <App>**. Catalog category Misc; the UI lists them first, as **Apps**, and keeps them out of chat-agent pickers.

- **`noodle`** (Noodle) — the fake social timeline. *(Changed in v2.4.2, #4763 — earlier guidance called it a built-in fourth chat mode opened from a top-bar @ button.)* It's an optional feature-only package; uninstalling removes the Home tab and stops its routes and schedulers after restart but keeps Noodle data for a reinstall. Its Latest Posts widget comes through the package. Timeline details → `architecture.md`.
- **`slurp2`** (Slurp; older catalogs: **Slurp Remastered**, next to the retired **Slurp Legacy**) — a private social App where characters and personas become Creators posting public or locked photos to a simulated audience (adult-tuned by default; prices are fictional). *(v2.4.6, #6235)* **Include Slurp activity** in a chat's **Chat Settings → Connected Chats** (off by default; carryover must also be on for that mode in Slurp's settings) lets that chat's characters remember recent Slurp posts and messages.
- **`gacha-forge`** (Gacha Forge) — *(v2.5.0)* a complete gacha game built from a world description: banners, a model-written and illustrated cast, story chapters told by a visual-novel narrator, battles, gear and events; lorebooks can feed the world.
- **Modern Life Sim** (**Life Sim** tab) — staging-only alpha at the v2.5.0 sync.

Each official pipeline agent has a default prompt template in `packages/shared/src/constants/agent-prompts.ts`. **Users can override any template** via the Agent Editor. *(v2.2)* When an overridden template is assembled as XML, **literal contract tags** the agent depends on (e.g. `<chat_summary>`, `<existing_entries>`) are honored verbatim; only values inserted through macros are escaped (#3548) — so a custom template can keep those structural tags intact without them being mangled.

**Phase overrides on built-ins (v2.1):** editing a built-in agent's phase in the Agent Editor is now honored in storage, normal generation, and manual retries — for Echo Chamber, Prose Guardian, Continuity, Immersive HTML, Expression, and Music DJ — instead of resetting to the built-in default. Agents like Prose Guardian and Continuity still **default** to `post_processing`, but a user's phase override now persists and takes effect. (Earlier docs describing these phases as fixed/force-pinned no longer apply.)

## Custom Agents

Users can create their own agents from scratch — or, if an installed package is close, hover its card in the Agents panel and click **Copy agent** for an editable custom copy. Check the catalog first: several classic custom-agent ideas (relationship tracking, inventory, memory nagging) now ship as official packages. The schema:

```typescript
{
  type: string,              // any string identifier
  name: string,              // display name
  description: string,
  phase: "pre_generation" | "parallel" | "post_processing",
  enabled?: boolean,         // legacy compatibility only — activation is per chat (chat metadata)
  connectionId: string | null,  // separate LLM connection, optional
  resultType?: AgentResultType,  // optional; how the agent's output is applied (see below)
  imagePath: string | null,      // optional avatar/icon for the agent
  promptTemplate: string,    // the system prompt for this agent
  settings: object,          // arbitrary config (contextSources, activation*, contextSize, …)
}
```

(The runtime `AgentConfig` also carries `id`, `tools`, `toolConfig`, and `createdAt`/`updatedAt`, which the server manages.)

**A custom agent is essentially a scoped LLM call with its own prompt, running in a specific phase** (often batched into a shared request with other agents — see "Stacking too many agents"). The agent returns output in a structured form (depending on its `resultType`) — but as of v2.4.0 **what context it receives is opt-in per agent.**

### ⚠️ Per-agent context sources (v2.4.0, #4305) — read before designing any custom agent

Custom agents no longer receive the full turn context by default. Each agent declares which sources it wants, stored under `settings.contextSources` and edited in the Agent Editor's **Context Sources** control.

From `CUSTOM_AGENT_CONTEXT_SOURCE_IDS` / `DEFAULT_CUSTOM_AGENT_CONTEXT_SOURCES` (`packages/shared/src/types/agent.ts`):

| Source | Default | What it feeds |
|---|---|---|
| `chatHistory` | **`true`** | Recent messages, depth = the agent's `contextSize` setting |
| `characters` | `false` | The character card(s) in the chat |
| `persona` | `false` | The selected persona |
| `activatedLorebookEntries` | `false` | Lorebook entries that activated this turn |
| `chatSummary` | `false` | The chat summary (in Roleplay, also needs **Attach chat summaries** — below) |
| `authorNotes` | `false` | Author's Note |
| `trackerData` | `false` | Tracker panel state |
| `recalledMemories` | `false` | Long-Term Memory / vector recall results |
| `previousOutput` | `false` | *(v2.4.6, #5945)* UI **Previous output**: the agent's own last visible-turn output, or its private `agent-context` (also available as `{{agent::TYPE}}` in its prompt). Forces the agent into its own request. |

**Chat history is the only default. Everything else is off.** This is the single most common cause of a custom agent that "used to know the character" and now doesn't.

Resolution, from `getAgentContextSources()` (`packages/shared/src/types/agent.ts`):

```ts
if (config.isCustomAgent || isRecord(settings.contextSources)) return normalizeCustomAgentContextSources(settings);
return { /* every source true except previousOutput */ };
```

Consequences worth stating to users:
- **Built-in / package agents can now choose too** *(changed in v2.5.0, #6356 — earlier guidance said they always get everything)*. Without a saved selection they still receive every source except `previousOutput`; once someone saves a Context Sources selection for one, that selection applies and survives save, export and reload. Agents batched into one request receive the **union** of their members' sources.
- **Roleplay agents don't see chat summaries by default** *(v2.4.6, #6225)*. Turn on **Attach chat summaries** in Chat Settings → Agents (chat field `attachSummariesToAgents`; off by default, including existing chats with no saved choice) when an agent needs them. It applies to every agent request — built-in and custom, post-processing, manual retries — so in Roleplay `chatSummary: true` alone delivers nothing. Summaries still reach the main reply, and agents granted full main-prompt access can read them inside that prompt. Conversation and Game are unaffected.
- An existing custom agent with no stored `contextSources` falls back to the defaults, i.e. chat-history-only. Upgrading can silently narrow an agent that previously reasoned over the card or lore.
- Turning `chatHistory` off forces `agentContextSize` to `0` — the agent sees no messages at all. That's valid for an agent driven purely by tracker state, but it's rarely what someone wants by accident.
- `recalledMemories` is what connects the Long-Term Memory package to a custom agent. Without it, memory recall never reaches the agent. (Advanced Memory Recall's recalled scenes never reach agents at all — it serves the main Roleplay reply only.)

**When recommending a custom agent, always name the context sources it needs.** "Create a continuity agent" is incomplete advice; "create a continuity agent with `characters`, `activatedLorebookEntries`, and `chatSummary` enabled (plus **Attach chat summaries** in Roleplay)" is actionable.

Design implication: narrower context is cheaper and more focused. Enable only what the agent's job requires rather than switching everything on reflexively — that's the point of the feature.

### Private continuation state and spoilers (v2.4.6, #5945; v2.5.0, #6254)

With **JSON context output** (`settings.jsonContextOutput`) the agent returns `{"text": "…", "agent-context": "…"}`: only `text` reaches the main prompt, and `agent-context` is a private memo the agent reads on its next run through **Previous output**. **Hide output as spoilers** keeps saved outputs collapsed until revealed; v2.5.0 shows separate public-output and private-context editors, and a response that omits `agent-context` keeps the previous turn's value. Continuation follows visible history (regenerations exclude the replaced turn; deleted messages and inactive swipes can't supply it). This is the native way to give an agent its own state across turns without variables or a tracker (`docs/CONFIGURATION.md`).

### Result types (what the agent returns)

From `AGENT_RESULT_TYPE_VALUES` (`packages/shared/src/types/agent.ts`, wrapped by `agentResultTypeSchema` in `agent.schema.ts`). The field is **`resultType`** (optional). **32 values as of v2.5.0** (28 at v2.3.4; added since: `character_card_create`, `inventory_tracker_update`, `character_activity_update`, `memory_nag`):

- *Text / prompt:* `text_rewrite`, `context_injection`, `prompt_patch`
- *Trackers & cards:* `character_tracker_update`, `custom_tracker_update`, `persona_stats_update`, `inventory_tracker_update`, `character_card_update`, `character_card_create`, `lorebook_update`, `memory_nag`
- *Cast:* `character_activity_update`
- *Narrative / continuity:* `continuity_check`, `director_event`, `secret_plot`, `quest_update`
- *Media / scene:* `image_prompt`, `background_change`, `sprite_change`, `echo_message`, `spotify_control`, `youtube_control`, `local_music_control` (local Game Assets music source), `haptic_command`, `frontend_theme_update`

> *(v2.4.0, #4337)* A custom agent whose `resultType` is **`image_prompt`** now gets the full **Illustrator-style control set**: image connection, reference image, appearance, and prompt controls. Previously these were exclusive to the Illustrator package. This makes `image_prompt` the practical route for "I want my own image agent with different framing rules" without forking Illustrator — recommend it instead of a webhook-to-your-own-image-backend for that use case. Since then: per-chat **Image Connection** override and a **camera button** that generates on demand in Chat Settings → Agents → Custom Agents (v2.4.2, #4686), per-chat **Image Style** (#4718), and a Gallery image-agent picker that runs any active custom image agent alongside Illustrator (#4846; Conversation too, #4940). Image agents always run in their own request. *(v2.5.0, #7053)* A card's or persona's **Image Appearance Override** replaces the full Appearance text in their image prompts (→ `character-cards.md`).
- *Game Mode:* `game_state_update`, `game_state_transition`, `game_master_narration`, `game_map_update`, `party_action`, `cyoa_choices`
- *Conversation:* `about_me_update`

**The custom-agent editor offers 21 of these** (`CUSTOM_AGENT_RESULT_TYPE_IDS`, `packages/client/src/lib/custom-agent-result-examples.ts`). The other 11 — `echo_message`, `quest_update`, `continuity_check`, `director_event`, `character_card_update`, `secret_plot`, `game_master_narration`, `party_action`, `game_map_update`, `game_state_transition`, `memory_nag` — are produced by built-in/package agents; don't design a custom agent around them. Each selectable type needs its matching capability (greyed out until that ability is on). *(v2.4.3, #5225)* The prompt editor previews the complete response shape for the selected type, optional fields included — copy field names from it instead of guessing.

**Lorebook-writing agents:** *(v2.4.3, #5225)* `lorebook_update` can set an integer injection `order` per entry; *(v2.4.3, #5191)* a configurable **Read Behind** depth keeps each delayed run tied to the reply it processed; *(v2.4.4, #5391)* opt-in **Enable chunked backfill** / **Backfill chunk size** works through old history on demand (chat action **Backfill next chunk**), each run continuing where the last stopped.

**Removed in v2.0:** `chat_summary` and `prompt_review` are no longer result types.

**Most user-defined agents** use `context_injection` (or leave `resultType` unset and just return text to inject) — the flexible option that works for the majority of custom agents.

### Activation — keywords, question, cadence: the cost control everyone misses

**Reach for this before telling a user an agent is "too expensive to run every turn."** A custom agent doesn't have to fire on its normal cadence; it can be gated to relevant scenes.

- **`activationKeywords`** — up to **100** keywords or phrases, one per line (`customAgentActivationSettingsSchema`, `agent.schema.ts`).
- **`activationScanDepth`** — how many recent messages to search. Default **5**, max **200** (`DEFAULT_/MAX_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH`, `packages/shared/src/constants/agent-activation.ts`).

The agent runs only when at least one keyword appears within that many recent messages. *(v2.4.1, #4498)* Pre-generation and parallel agents scan the conversation before the reply; **post-processing agents also see the completed reply**, so Scan Depth 1 covers the message they process. **Leave the keyword box empty to run every time on the normal cadence** (**Trigger Cadence**, `settings.runInterval`) — that's the default, and it's why unconfigured agents feel expensive.

**Activation question (v2.5.0, #6530).** An optional statement answered by the **Decision model** catches paraphrases keywords miss. Fields in `settings`: `activationQuestion` (≤500 characters, macros allowed — despite the name, write a **statement of fact about the latest message**, e.g. "The latest message moves the scene to a new place", not a question), `activationThreshold` (0.05–0.95, UI **Run when probability is at least**; leave unset to use the selected model's recommended value — probabilities aren't comparable across models: 0.5 for local chat models and hosted Decision connections, 0.1 for the built-in Open-Jev models, so re-check after switching), and `activationMaxSkip` (1–100, UI **Bypass the question after this many messages without a successful run** — set it for any agent that matters). It uses the same Scan Depth. Keywords and cadence are checked first, so an already-skipped agent costs no decision request; with no Decision model, a timeout or a bad answer, the agent runs normally (fails open), and the fields stay disabled while Decision model is **None**. Decision models, statements in agent prompts and the shared fallbacks → `conditional-prompts.md`.

This changes the standard advice. "Don't build a lore-checking agent, it'll cost you every turn" becomes "build it, and gate it on the proper nouns that matter" (or on a question for paraphrase-heavy triggers). Combine with a narrow `contextSources` set (above) and an agent can be genuinely cheap.

### Agent Budget (`contextSize` / `maxTokens`)

Two per-agent settings, shown in the editor as **Agent Budget** (`docs/agents/custom-agents.md`; constants in `packages/shared/src/types/agent.ts`, `DEFAULT_AGENT_CONTEXT_SIZE` / `DEFAULT_/MIN_/MAX_AGENT_MAX_TOKENS`):

| Setting | Default | Range | What it controls |
|---|---|---|---|
| `contextSize` | **5** | 1 – `MAX_AGENT_CONTEXT_MESSAGES` | How many recent messages the agent reads |
| `maxTokens` | **4096** | **128 – 32768** | Output room reserved for the agent's reply |

`normalizeAgentContextSize` clamps out-of-range values back to the default. **These interact with context sources:** if `chatHistory` is off, `agentContextSize` is forced to `0` and the agent sees no messages at all — valid for an agent driven purely by tracker state, rarely what someone wants by accident.

### `triggerLorebooksForAgentCalls` — not the same as lorebook context

A per-agent opt-in (`settings.triggerLorebooksForAgentCalls`, gated in `agent-executor.ts` and `generate.routes.ts`, custom agents only). Users conflate it with the lorebook context source; they're different:

- **`contextSources.activatedLorebookEntries`** — passes entries that *already fired this turn* into the agent's prompt.
- **`triggerLorebooksForAgentCalls`** — makes the agent call *itself* trigger a lorebook scan, so entries can activate that the main turn never matched. It also forces the agent into its own request.
- **Attach Lorebooks to Trackers** *(v2.4.3, #5197)* — a separate Roleplay chat setting (shown when Tracker agents are active) that forwards the exact entries activated for the main reply to Tracker prompts, automatic and manually retriggered.

If lore is reaching an agent unexpectedly (or costing more than expected), check the second flag before the first.

### Named prompt options (one agent, several behaviors)

A single custom agent can hold multiple named prompt variants. Each chat then picks one from a **Prompt Mode** dropdown without editing the agent globally; with no options defined, the chat menu shows only the default prompt (`docs/agents/custom-agents.md`). *(v2.4.2, #4640/#4663)* Active built-in tracker agents in Game and Roleplay also expose their prompt templates as a per-chat choice in Chat Settings.

**Recommend this instead of cloning an agent per variant.** "A tone enforcer that's Victorian in one chat and hardboiled in another" is one agent with two named options, not two agents — and it halves the per-turn cost of running both.

### Getting an agent's output into the prompt

Two supported routes, both worth knowing because they qualify the usual "prompt assembly isn't user-extensible" line:

- **`{{agent::TYPE}}`** — a macro inserting an agent's saved output wherever you place it (`packages/shared/src/utils/macro-engine.ts`). It renders only *after* the matching agent has run. Easiest added via **Preset Editor → Add Section → Agent**.
- **"Add as Prompt Section"** — a per-agent toggle exposing the agent's latest output as a section injectable in a prompt preset.

So an agent's result is a first-class prompt input, not just a side effect. This is the mechanism behind trackers appearing in the prompt. Agent prompt templates can themselves branch on Decision statements (`{{#if decision:"…"}}`) → `conditional-prompts.md`.

### Cached prompt injections

Agent output is cached and re-injected, and there's a **Cached prompt injections panel** (`docs/agents/approvals-and-agent-suite.md`) showing what's currently held — the **Injections** tab of **Agent activity** in a Roleplay chat, visible only with **Debug mode** on (Settings → Advanced). This is the answer to *"why is this agent's old output still in my prompt"* — check the panel before assuming the agent re-ran. Edits and re-runs there take effect only when that same reply is regenerated.

### Tool-using agents

Agents can call tools too — the agent executor supports tool-calling loops. An agent with `toolContext` set can make tool calls, receive results, and continue until it's done. This allows custom agents to do things like "look up current weather, then inject that as world state context."

Custom tools are attached to an agent explicitly (`docs/extending/custom-tools.md` → "Attaching tools to an agent"), and only work when the chat's **Enable Tool Use** is on. Remember tools do **not** travel with an exported agent (#3953) — see `custom-tools.md`.

See `packages/server/src/services/agents/agent-executor.ts` for the loop implementation.

### Custom agent capabilities (v2.0)
Custom agents have an explicit capability model — `CUSTOM_AGENT_CAPABILITY_IDS` (`packages/shared/src/types/agent.ts`). All **15** as of v2.5.0, in source order:

`create_characters`, `create_lorebooks`, `edit_lorebooks`, `edit_messages`, `edit_trackers`, `change_frontend_styling`, `change_backgrounds`, `change_sprites`, `control_media`, `control_haptics`, `edit_about_me`, `trigger_image_generation`, `access_vectors`, `edit_main_prompt`, `manage_chat_characters`

These gate what an agent is allowed to do and are derived from the agent's `resultType`, its enabled tools, and `settings.customCapabilities`. Note the five media/scene capabilities (`change_backgrounds`, `change_sprites`, `control_media`, `control_haptics`, `edit_about_me`) — they're the ones most likely to be relevant when someone asks "can my agent change the background / play music / buzz the toy / update About Me," and the answer is yes, with the matching capability.

The two added in v2.4.4 change design advice:
- **`create_characters`** (UI **Create character cards**) ↔ result type `character_card_create` (**Character Card Creation**) — the agent proposes one complete, editable character card that is saved to Characters only after the user approves it (#5456). The route for "auto-generate NPC cards as they appear."
- **`manage_chat_characters`** (**Choose active chat characters**) ↔ `character_activity_update` (**Character Activity**) — a pre-generation agent picks the nonempty set of attached cards used for this Conversation or Roleplay reply, keeping the rest out of that turn's prompt (#5310). Character Activity agents always run before the main reply. The route for a "cast director" / token saver in big group chats.

### Home widgets (v2.5.0, #6621)
In the editor's **Home widgets** section a custom agent can offer up to **three** Home widgets (title, description, Compact / Large). Nothing is placed automatically — users add, hide and reorder them in the Widget Manager — and the agent can publish up to 500 characters to each widget while it runs. A cheap way to surface an agent's running notes outside the chat.

### Turn Data Access (v2.0)
Post-processing agents can **opt in** to see the current turn's data: `preGenInjections` (what pre-generation agents injected) and `parallelResults` (parallel-phase results). It's off by default — only opted-in agents receive it (`AgentContext.preGenInjections` / `parallelResults`).

### Game Mode & mode gating
v2.0 added **Game-Mode custom-agent selection** in Chat Settings (the picker sits at the bottom of the Agents section). *(v2.3)* Selected **custom agents now run in all three modes** — Conversation, Roleplay, and Game — whenever the chat's Enable Agents master toggle is on (#3692). `modeAllowlist`-style per-mode gating applies **only to official packages**, surfaced as the Conversation/Roleplay/Game compatibility badges in Download Agents — so not every official agent is offered in every mode.

**(v2.1)** Game Mode also exposes per-chat **media prompt preset** selectors in Chat Settings > Agents — Illustration Prompt, Animation Prompt, and Game Video Prompt — with read-only built-ins (Still Keyframes, Comic Page, Colored Manga, B&W Manga, Cinematic Scene Video) that users copy into chat-local editable versions. These pair with the Game Illustrator toggle (see the `illustrator` entry above). The full media-preset doc lives in architecture.md.

**(v2.2)** A registered **Noodle Timeline Voice & Tone** prompt override (Settings > Generations > Image Generation Prompt Overrides) lets the tone/creative-freedom portion of Noodle's refresh prompt be user-rewritten, while its structured-action and output-format rules stay hardcoded outside the override so a rewrite can't break refresh generation. Noodle isn't a pipeline agent — it's an App package (see Apps above); references/architecture.md covers the Noodle refresh pipeline.

### Exporting & importing agents (v2.0)
Custom agents export/import as a single JSON payload **or** as a **folder/zip package** (`packages/client/src/lib/agent-transfer.ts`), so a complex agent can travel with related files/code instead of just one JSON blob. **Select agents** in the Agents panel exports several at once.

*(v2.3.4)* Import/export is hardened (#3953): exports **no longer bundle custom function definitions**, and an imported agent file can no longer install bundled custom functions, grant itself tool access, or overwrite a curated agent by reusing its internal `type`. Imports land under a fresh custom identity (`custom-import-<slug>-<suffix>`), and the recipient must review the agent and **explicitly re-attach any tools** — so recommendations involving shared agent files should include that re-attach step.

External imports (files, folders, custom repositories) are **locked until Settings → Advanced → Danger Zone → Allow custom Agent imports** is on — no `.env` change needed. Every import shows a permission review; unchecked capabilities stay blocked. Turning the switch off again stops externally imported agents from running; agents made in Marinara and Download Agents packages are unaffected. *(v2.5.0, #6605)* Importing an agent (or installing a catalog package) that uses an activation question or decision statements warns when no Decision model is selected and explains the fallback.

## The memory surfaces — often confused

`docs/agents/memory.md` calls it "the two memory systems," but as of v2.5.0 there are six related surfaces (plus two look-alikes). Disambiguate before advising, because users say "memory" for all of them:

| Surface | What it is | Scope |
|---|---|---|
| **Memory Recall** | Built-in embedding retrieval over past messages (Chat Settings → Memory Recall → **Enable Memory Recall**). Needs an **embedding source** configured; re-vectorize after changing embedding models. *(v2.4.0, #4304)* discards superseded message revisions and injects only the current edited text. *(v2.5.0, #7150)* **Mutually exclusive with Advanced Memory Recall** — turning either on turns the other off (and stops Advanced Memory's running work). | Per chat, every mode |
| **Advanced Memory Recall** | *(v2.4.6 Alpha, #6102; out of Alpha in v2.5.0, #6749)* Roleplay-only opt-in context manager: scene detection, scene summaries with bounded excerpts, automatic compression at a token cap. Built in — no package, and it runs regardless of **Enable Agents**. Details below. | Per Roleplay chat |
| **Chat Summary** | Condensed history (Roleplay). Summary Connection has its own max output size. *(v2.4.0, #4334)* multiple ordered summaries can be **selected and condensed into one** entry. *(v2.4.4, #5240/#5346)* long chats can keep recent summaries in context and semantically retrieve relevant older ones (manual and range-backfilled entries included); *(v2.4.6)* several explicit message ranges can be generated as separate chronological entries. Roleplay agents see summaries only with **Attach chat summaries** on. | Per chat |
| **`daySummaries` / `weekSummaries`** | Conversation's **Automatic Summarization**: day summaries rolled up into week summaries (`chat.schema.ts`), distinct from Chat Summary; can't be turned off in Conversation. | Per Conversation chat |
| **Long-Term Memory** | An installable **catalog package** (feature package; pre-generation recall in Conversation, Roleplay and Game) for durable cross-session memory. | Package |
| **Memory Nag** | *(v2.4.4)* Roleplay Tracker package: a per-chat vault of short character memories that it "nags" back into the next reply when relevant (see its entry above). | Package, per chat |

Two look-alikes, one line each:
- **Context pins** *(v2.5.0, #6698)* — **Pin to context** keeps up to ten chosen messages in the prompt → `architecture.md`.
- **Professor Mari's Saved Memories** *(v2.4.2, #4851)* — Mari's own standing preferences and directives, not chat memory → `architecture.md` (Professor Mari).

**The wiring that matters:** a custom agent sees recall output only if its **`recalledMemories`** context source is enabled. Long-Term Memory being installed is not sufficient — the agent must ask for it. That's the single most common "my memory agent doesn't remember anything" cause. Advanced Memory Recall serves only the main Roleplay generation: agent calls, manual agent reruns and auxiliary dry runs neither trigger it nor receive its summaries or excerpts.

### Advanced Memory Recall (Roleplay)

Enable in **Chat Settings → Memory Recall → Advanced Memory Recall**, or **Automatic context and memory handling** below Agents in the Roleplay setup wizard. While on, it owns retrieval (Standard Recall won't insert a second copy) and replaces the ordinary automatic Roleplay summary schedule; turning it off restores both. Full guide: `docs/agents/memory.md`.

- **Knobs:** **Maximum allowed context before compression (tokens)** — when the outgoing prompt reaches it, the live window resets to the start of the latest scene for all characters (shown in **Mark as new start** with **All** selected; uncheck to undo). **Summary and recall budget (tokens)** — constants target ≤70% of it; priority is constants, then scene summaries, then excerpts, with up to 2,000 extra tokens. **Helper model** (defaults to the agent connection, then the chat connection) writes recaps; summary calls use **Chat Summary → Maximum output size**, at least 8,196 tokens. **Maximum recalled scenes** default 3 (0 disables optional recall). **Moving context** excerpts default 3–10 messages. **Standalone scene check interval (messages)** default 5.
- **Existing chats:** click **Prepare existing history** (batched; **Cancel** keeps completed work; **Resume** survives restarts and updates). *(v2.5.0)* **Pause processing** / **Resume processing** work during setup too. Progress shows as **Advanced Recall** in **Chat Settings → Agent activity**, even with ordinary agents disabled.
- **Use Decision model** *(v2.5.0, #6749)* with a per-chat **Memory Decision connection** picks scene endings and which recaps/excerpts to recall; the Helper still writes summaries; misses fall back to ordinary recall → `conditional-prompts.md`.
- **Privacy:** scenes are accessible only to their participants; recaps use `{{#if character == "Name"}}` for private POV sections. Global **Hide from AI** only removes a turn from the live transcript — Advanced Memory still summarizes and indexes it for permitted recall; character-specific hiding does restrict it.
- **Preset markers:** `chat_summary`, `current_scene_summary`, `recalled_scenes` (legacy `recalled_messages` is an alias); without them, components fall back once before history.
- **Archive:** **Access memories for this chat** searches numbered scene summaries; edit **Summary text** or the **Story timeframe**, disable a record to keep it out of recall, **Delete summary**, **Reindex**, or **Delete all memories** to restart preparation (original messages are never touched).

## When to Use an Agent vs. Other Surfaces

**Agent** — automatic, per-turn, background.
**Tool** — model-invoked, on-demand, when the model decides it's needed.
**Lorebook** — keyword-triggered, no LLM call needed beyond pattern matching.

Rule of thumb:
- **Needs to happen every turn without being prompted?** → Agent.
- **Needs to happen when a topic comes up?** → Lorebook.
- **Needs to happen when the user asks for it?** → Tool.
- **Always relevant static info?** → Character card description.

### Good custom agent candidates
- A "historical accuracy checker" for a period RP (runs post-processing, flags anachronisms)
- A "tone enforcer" for a specific writing style (runs pre-generation, injects style directives)
- A "foreshadowing director" that injects subtle plot hints when specific conditions are met
- A "cast director" for a large group chat (pre-generation, `manage_chat_characters`) that keeps idle characters out of the turn's prompt
- An "NPC card generator" (`create_characters`) that proposes a card when a new recurring character appears
- A tracker for something no package covers (custom JSON state each turn). For relationships, install **Relationship Tracker** first (stable at v2.5.0); for items, **Inventory Tracker** or **Quartermaster** — earlier guidance offered a custom relationship tracker as the example.

### Bad custom agent candidates
- "Call my API to look up X" — use a tool instead; agents shouldn't be doing user-requested actions.
- "Remember things the user says" — use the memory surfaces above (Memory Recall / Advanced Memory Recall, Long-Term Memory, Memory Nag) or lorebook-keeper, not a custom agent.
- "Rewrite every message to be more dramatic" — prose-guardian already does this flavor of work, probably better than your custom agent will.
- "Respond as a different character" — that's not an agent, that's a group chat. (Choosing *which* characters respond is now agent-able — the cast director above.)

## Tuning and Pitfalls

### Stacking too many agents
Every enabled agent adds instructions and usually model work — but **not necessarily its own call**. Agents that share a connection are grouped into one request where possible, and Prose Guardian, Continuity Checker and Immersive HTML share one rewrite call. *(Corrected at the v2.5.0 sync — earlier guidance said every enabled agent is a separate LLM call, so 8 agents = 9 calls.)* *(v2.5.0, #6977)* The agent editor's **Share requests with other agents** switch (under **Connection Override**; `settings.batchWithOtherAgents`, on by default) sends an agent in its own, slower request instead — the fix when a local model mixes up batched tasks. Some agents always run alone and show the switch as off: Illustrator, Beholder, Lorebook Keeper, custom Text Rewrite and image agents, and any agent using **Previous output**, **JSON context output**, `triggerLorebooksForAgentCalls` or vector access. Activation questions add Decision requests (batched per phase). Chat Settings → Agents shows a **load readout** (instruction tokens and extra calls per turn) that turns amber when heavy; real cost is higher because history and card details ride along with each call.

**Recommendation for most characters:** 0–3 agents. More only if the project specifically benefits.

*(v2.5.0, #6977)* Retrying or re-running agents runs rewrite agents one after another, each on the previous one's output (before, retrying Prose Guardian with a custom Text Rewrite agent kept only the last one's edits), and retries respect the connection's **Max Parallel Agent Jobs**.

*(v2.2)* Roleplay tracker agents support **per-agent manual scheduling**: individual trackers can be excluded from automatic post-turn runs and fired on demand from the HUD, instead of forcing the whole tracker suite into all-or-nothing manual mode (#3522) — a good way to keep an expensive tracker off the per-turn path without disabling it.

*(v2.4.0)* Two run-behavior changes worth knowing when tuning cost:
- **Run Interval now counts both user and assistant messages** (#4360), across custom agents, Illustrator, Lorebook Keeper, Card Evolution Auditor, About Me Keeper, Narrative Director secret-plot maintenance, and Roleplay Storyboards. An agent set to `runInterval: 5` therefore fires roughly twice as often as the same setting did before, since a turn contributes two messages. **If a user upgrades and their image/lorebook agents suddenly feel twice as chatty, this is why** — tell them to roughly double the interval to preserve the old cadence.
- **Tracker panels appear as soon as their matching tracker agents are active**, so starting values can be entered before the agent's first run. Useful for seeding a tracker rather than letting the model invent turn-one state.
- *(#4351)* **Name Prefix** now carries each responding character's identity into post-processing agent prompts in multi-character Roleplay, while rewrite agents' raw response text stays unchanged — relevant when a post-processing agent needs to know *who* spoke in a group chat.

### Choosing the agent's LLM
Each agent can have its own `connectionId`. Useful patterns:
- Use a **cheap/fast model** (Gemma sidecar, GPT-4o mini, Haiku) for trackers and extractors.
- Use the **main model** for prose-guardian, continuity, and anything that needs literary sensitivity.
- Use a **vision-capable model** for agents that need to see generated images (rare).

*(v2.4.4, #5539)* The built-in Local Model can be the default agent connection (Connections → defaults), and the Agents panel has a bulk action that points every agent at one connection or resets them all to the agents default.

**Agents inherit the connection's generation settings.** *(v2.4.2, #4614)* Temperature and parameter-send policy (0.7 when no temperature is set); *(v2.5.0, #7131)* also everything saved under **Use custom defaults for this connection** — Top P/K, frequency/presence, **Reasoning Effort**, Verbosity, custom parameters and headers. Custom defaults start Reasoning Effort at **Maximum**, which now overrides the "off" that JSON agents used to request — so turning on custom defaults for a connection that agents share can make every agent reason at Maximum. Name this in cost/latency advice.

**Max Parallel Agent Jobs** (a connection setting; v2.4.2, #4609/#4950) caps concurrent agent batches on that connection, and sets llama-server parallel slots for the Local Model.

The built-in Gemma 4 E2B sidecar is specifically designed to handle tracker agents locally, keeping tokens off your main provider bill; *(v2.4.4, #5537)* JSON agents on it are grammar-constrained to a JSON object, ending "invalid JSON" failures. *(v2.3.4)* After a successful local Gemma model download, a notice asks you to **completely restart Marinara Engine** before use.

### Conflicting agents
If you enable both `world-state` and a custom tracker that also manages location/weather, they can step on each other. Disable one, or use the `custom-tracker` with locked fields. *(v2.1)* Roleplay/Game trackers support locking individual fields, and tracker / custom-agent update agents respect per-field locks — a locked field can't be bypassed by an AI update that renames or replaces the locked row at the same position.

### Agent prompt templates
Default templates are decent but generic. For production use, customize the `promptTemplate` to match your specific style, genre, or constraints. The default prompts are in `packages/shared/src/constants/agent-prompts.ts` — reading them gives a good starting point for custom variants.

### Debugging agents
- **Chat Settings → Agent activity** (Roleplay; its own section just below Agents, also at the bottom of the Tracker Panel): the **Activity** tab lists agent outputs, a failed list with retry, a stop control, re-run trackers and **Clear Trackers**; the **Injections** tab appears with Debug mode. *(v2.4.6, #5860)* Roleplay's Agents menu shows per-agent phase, tokens, time to first output and elapsed time; *(v2.4.4, #5237)* **Stop Agents** cancels running parallel/post-processing work without aborting the main reply or blocking new messages.
- For a full trace, turn on **Debug mode** (Settings → Advanced → Message Tools): it logs each agent's prompt and response to the server console and shows an **Agent Debug** overlay.
- The Agent Editor shows the agent's last run and output.
- Run the agent with `agent-executor`'s built-in retry mechanism if needed.

## Example: A Custom "Historical Accuracy" Agent

For a Regency-era roleplay:

```json
{
  "type": "historical_accuracy_regency",
  "name": "Regency Accuracy Check",
  "description": "Flags anachronisms in the generated message (post-1820 references, modern slang, wrong social conventions).",
  "phase": "post_processing",
  "enabled": true,
  "connectionId": null,
  "promptTemplate": "You are a Regency-era historian (1811-1820, English). You'll receive a passage of narration/dialogue. Your ONLY job is to flag anachronisms:\n- References to events, inventions, or people after 1820\n- Modern slang or phrasing that's out of period\n- Incorrect social conventions (dress, titles, conduct)\n- Wrong geography or currency\n\nReturn a JSON object:\n{ \"issues\": [\"description of issue 1\", \"...\"], \"clean\": true|false }\n\nIf no issues, return { \"issues\": [], \"clean\": true }.\n\nThe passage:\n{{message}}",
  "settings": {}
}
```

This would run after every generation, return a structured check, and (if wired to a rewrite agent — `continuity` or `prose-guardian`) trigger rewrites on issues.

## API Endpoints

All under `/api/agents` (`packages/server/src/routes/agents.routes.ts`):
- `GET /` — list
- `GET /:id` — one
- `POST /` — create
- `PATCH /:id` — update by id
- `PATCH /type/:agentType` — update a built-in by type
- `DELETE /:id` — delete
- `PUT /toggle/:agentType` — enable/disable (note: `PUT` on `/toggle/:agentType`, **not** `POST /:id/toggle`; there is no `PUT /:id` "replace")
- `POST /:id/image`, `GET /images/file/:filename` — agent avatar/icon
- `GET /import-policy`, `PATCH /import-policy`, `POST /import` — the Allow custom Agent imports gate and reviewed imports
- `GET /echo-messages/:chatId`, `DELETE /echo-messages/:chatId` — echo-chamber output
- `GET /runs/:chatId/custom`, `PATCH /runs/:runId`, `DELETE /runs/:chatId` — agent run records
- `GET /cadence/:agentType/:chatId` — run-cadence state
- `GET /memory/:agentType/:chatId`, `PATCH /memory/:agentType/:chatId`, `DELETE /memory/:agentType/:chatId` — agent memory
- `POST /suite/rewrite` — Agent Suite AI-assisted rewrite
- `GET /:id/home-widgets/:widgetId/state` — Home widget state; `GET`/`PUT /beholder-state/:chatId`, `GET /beholder-runs/:chatId` — Beholder

## UI Location

**Agents Panel** (right sidebar → sparkles icon). *(v2.3)* Lists **installed packages** (catalog artwork, star fallback when art is missing) plus the **Download Agents** entry point (custom tools are *not* here — they live in **Presets → Functions**, see `custom-tools.md`); uninstalling a package refreshes the open sidebar immediately. *(v2.5.0)* Installed agents are grouped **Apps / Writer Agents / Tracker Agents / Misc Agents**, plus **Custom Agents** and a **Rules** section for installed Game Mode rulesets (→ `rulesets.md`). Each agent has a full editor for its prompt, connection override, and settings. **Chat Settings > Agents** stays available in all three modes even with nothing installed — empty sections (and the empty setup-wizard Agents step) link to Download Agents, and built-in Conversation commands remain configurable without any downloads. Besides **Enable Agents**, it holds **Attach chat summaries** (Roleplay), **Review Agent Outputs**, **Manual Trackers** (Roleplay), the **Agent Suite** button and the load readout. *(v2.5.0, #7034)* Chat Settings itself is now a movable window opened from the sliders button inside the chat → `architecture.md`.

### Agent Suite (v2.1)
Opened from **Chat Settings → Agents → Agent Suite**, the Agent Suite lists the agents active in the current chat and lets you view and edit everything they have **stored** — grouped as **Stored Memory**, **Tracker Data** (tracker agents) and **Recent Outputs** (custom agents); Narrative Director spoilers stay hidden behind **Reveal spoilers**. Edits can be made **manually** or via **AI-assisted rewrites**: select text (or rewrite-all), give an instruction, optionally add grounding via the **Add Context** picker (character cards / active-lorebook entries, max 20 sources / 100k chars), and choose a connection. It reads/writes the existing `/api/agents/memory` and `/runs` endpoints (source: `AgentSuiteModal.tsx`).
