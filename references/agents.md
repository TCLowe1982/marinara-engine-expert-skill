# Agents

Agents are **autonomous LLM sub-systems that run during message generation**. They handle side tasks like state tracking, prose quality enforcement, continuity checking, image generation, and music control — running before, alongside, or after the main response.

*(v2.3)* Official agents are **downloadable packages, not built-ins** — a fresh install ships **zero optional agents**. The model is two-step: **install** a package from Agents → Download Agents, then **enable** it per chat. Each enabled agent adds latency and token cost per turn, so the right recommendation is usually the minimum viable set — and any recommendation that relies on an official agent must include the install step.

**Source of truth:** Engine runtime — `packages/server/src/services/agents/` (agent-executor.ts, agent-pipeline.ts), `packages/shared/src/schemas/agent.schema.ts`, `packages/shared/src/constants/agent-prompts.ts` (default prompt templates for official agents). *(v2.3)* Packaged-agent feature code lives in **`Pasta-Devs/Marinara-Agents`** (`packages/<id>/`); upstream reference doc: `docs/agents/built-in-agents.md`. *(v2.3.4)* The contract cleanup removed the obsolete generated registries — `agent-registry.generated.ts` no longer exists; don't cite it — along with unused agent/turn-game contract members, duplicate tool arrays, Visual Novel types, and chat-mode definitions (legacy downloadable-agent package parsing is preserved). The empty `BUILT_IN_AGENTS` array now lives in `packages/shared/src/types/agent.ts`, populated at runtime from installed package manifests; `BUILT_IN_AGENT_IDS` (21 legacy/compatibility ids) and `RETIRED_BUILT_IN_AGENT_IDS` survive there. `BuiltInAgentMeta` carries `category` (`'writer' | 'tracker' | 'misc'`) and `execution` (`'pipeline' | 'feature'`) fields.

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

**Cost:** Adds latency after generation finishes but before results fully settle.

## Downloadable Agents (v2.3)

v2.3.0 moved every optional agent out of the base Engine into **downloadable capability packages** (25,000+ lines of agent/map/call/table-game code removed from the Engine). Fresh installs contain **no** optional agents; existing installs migrate selections, settings, and history automatically.

### The Download Agents library

**Agents → Download Agents** is a full-page library for official packages: install, read about, update, and uninstall each one. Packages are grouped **installed / uninstalled**, ordered **Writer, Tracker, Misc**, with creator artwork (star fallback when art is missing). **Install All / Uninstall All** run through a safe sequential queue. *(2.3.2)* Each package shows **Conversation / Roleplay / Game compatibility badges**, and the catalog is searchable by mode (#3676). *(v2.3.4)* The official catalog is no longer the only source — see **Custom GitHub agent repositories** below.

### Package catalog

First-party packages are published in **github.com/Pasta-Devs/Marinara-Agents** as individually verified packages — **31 packages as of v2.4.0**: 6 Writer, 8 Tracker, 17 Misc (full list below). Trust model: schema validation, SHA-256 checksums, per-file hash/size checks, atomic install, and offline availability once installed. Professor Mari's prompts carry the canonical 31-package summary, so she can compare and recommend packages in-app. Upstream reference doc: `docs/agents/built-in-agents.md` in the Engine repo.

*(2.3.3)* Each Engine major installs/updates only from its matching **catalog lane** — `catalog/v2/catalog.json` for Engine 2, `catalog/v3/` for Engine 3, with `catalog/catalog.json` as a legacy v2 alias (#3712).

*(2.3.5)* Two security changes to package distribution:
- **Updates now prompt per version.** Silent startup updates for installed packages were replaced with a responsive per-version confirmation. Choosing **No** records that decision without changing the installed package; the manual **Update** action stays available in Agents → Download Agents. (2.4.0 corrected Mari's guidance to match this user-confirmed flow.)
- Official catalog artifacts are **restricted to canonical Marinara-Agents repository URLs**, while explicit custom-catalog overrides are preserved.

### Custom GitHub agent repositories (v2.3.4)

The Agents Manager can also install packages from **custom GitHub agent repositories** — a third-party agent-source path alongside the official catalog (#3861). **Disabled by default.** Key properties: updates are **manual preview/apply** (no auto-sync), each repository requires an **explicit per-repo trust confirmation**, sync identity is stable, and archive validation is bounded and SSRF-safe. This is the supported way to distribute third-party packages outside the official catalog.

### Package lifecycle

- *(2.3.1)* Installed packages check the catalog at **server startup** and auto-upgrade to the newest compatible version before their runtimes activate. Offline, incompatible, missing, or failed updates keep the previous version; a verified runtime failure rolls back automatically.
- *(2.3.2)* Catalog HTTP failures report real status, and installed agents keep working offline (#3706/#3707).
- *(2.3.3)* Incompatible package versions are **quarantined** before their hooks can crash generation (#3647).

### Enable Agents master toggle

Each chat has an **Enable Agents** master switch gating all agent initialization and model calls: with it off, no selected agent — including package services — initializes or calls a model. The setting survives the v2.3 capability migration without needing to be re-enabled (#3669). *(2.3.3)* Hierarchical Maps fully obeys it (UI, prompt generation, lorebook previews, retries, tracker patches, carryover, checkpoints).

### Capability API (packages)

*(2.3.2)* Packages run against **capability API 1.3** (#3690), whose host services cover safe model routing, persistence, history/checkpoints, resources, logging, transactions, client contribution loading, and visible readiness/retry states. The base Engine keeps validated capability registries and compatibility bridges; capability-owned tables resolve via registered schema names (#3647). Relevant if you're authoring or debugging a package rather than a plain custom agent.

### Upgrading to v2.3

Upgrades from ≤2.2 migrate agents and chat feature selections without losing settings, data, or history; the migration is restart-safe and idempotent (#3670). Known bug: the 2.3.2 migration auto-selected Hierarchical Maps everywhere — 2.3.3 ships a one-time correction (#3723).

## Official Downloadable Agents

These were the "built-in agents" through v2.2; *(v2.3)* they are now the **31-package official catalog** described above. None are present on a fresh install — install from Download Agents first, then enable per chat. Pipeline packages are listed by phase, with the `id` you reference in config, the display name, and the catalog category (**Writer / Tracker / Misc**); feature packages (package-owned runtimes, `execution: "feature"`) follow in their own subsection.

> **Retired — don't reference these:** `prompt-reviewer`, `response-orchestrator`, `schedule-planner`, `chat-summary`, `autonomous-messenger`, `youtube`, `secret-plot-driver`, and *(v2.3)* `about-me-keeper` are in `RETIRED_BUILT_IN_AGENT_IDS` and are neither built-ins nor packages. (Chat summary survives only as a prompt constant, not an agent. Conversation's **About Me** profile and the `update_about_me` tool remain built into the Engine — they are **not** downloadable agents — and as of 2.3.2 About Me drafting goes through Professor Mari.)

### Pre-generation
- **`director`** (Narrative Director — Writer) — pacing directives, dramatic beats, scene transitions.
- **`knowledge-retrieval`** (Knowledge Retrieval — Writer) — embedding-based semantic search across lorebook entries / knowledge sources; closest thing to traditional RAG.
- **`knowledge-router`** (Knowledge Router — Writer) — lower-cost RAG alternative: selects relevant lorebook entries by ID and injects them directly.
- **`html`** (Immersive HTML — Misc) — formats messages with custom HTML/CSS. `runtimeDisabled`: it injects formatting into the last user prompt rather than running as a separate agent call.

### Parallel
- **`echo-chamber`** (Echo Chamber — Misc) — absent characters / sidebar reactions to the current scene. *(v2.1)* Fires only on fresh user messages; it does **not** trigger on `/continue` continuation rewrites.
- **`combat`** (Combat — Misc) — turn-based combat mechanics computed alongside narration.

### Post-processing
- **`prose-guardian`** (Prose Guardian — Writer) — repetition analysis, rhetorical-device selection, sentence variety, sensory rotation. *Defaults to post_processing (phase overridable — see below).*
- **`continuity`** (Continuity Checker — Writer) — flags/repairs contradictions with established lore. *Defaults to post_processing (phase overridable — see below).*
- **`world-state`** (World State — Tracker) — tracks date/time, weather, location, and present characters. *(v2.2)* No longer a fixed built-in field set: users can add **custom fields** and toggle **per-field hide** controls, with inline editing and lock-aware persistence, surfaced in both the Tracker Panel and Roleplay HUD (#3518).
- **`character-tracker`** (Character Tracker — Tracker) — present characters, moods, relationships, appearance/outfit, stats. *(v2.2)* Also supports user-defined **custom fields** and per-field hide/lock like World State. Stat values may be **structured objects** — `{ name, value, max, color }` (e.g. HP/MP bars), normalized by `rpg-stats` — not just plain numbers/strings; the Present Characters tracker now renders these safely instead of crashing (#3563).
- **`custom-tracker`** (Custom Tracker — Tracker) — user-defined tracking (any JSON state).
- **`persona-stats`** (Persona Stats — Tracker) — updates player/character RPG stats. Stat pools use the structured `{ name, value, max, color }` shape (see Character Tracker).
- **`quest`** (Quest Tracker — Tracker) — quest objectives, completion, rewards.
- **`expression`** (Expression Engine — Tracker) — picks character sprite expressions from emotional content. *(v2.1)* Expression portrait sprites can also be produced as short **video** clips via a Video Generation connection and converted to looping GIFs, then saved into expression slots (Advanced > Video Generation sets duration/prompt; `animatedExpressionClipDurationSeconds` default 3s). See character-cards.md / architecture.md for the media path.
- **`background`** (Background — Tracker) — picks the scene background image. *(v2.3.4)* **Selection-only:** the agent's image-generation toggle and runtime were removed — it now only selects from existing library backgrounds; automatic and Gallery background *generation* belong to Illustrator (see the `illustrator` entry). *(v2.1)* In Game Mode, a manually selected chat background now overrides automatic GM scene-background selection until the user removes it (mirrors the tracker field-lock "manual pin wins" pattern).
- **`illustrator`** (Illustrator — Misc) — generates scene illustrations via an image provider (default `runInterval: 5`). *(v2.3.4)* **Owns background generation:** automatic and Gallery background generation run through Illustrator's background prompt mode — the Gallery Background action routes through it (#3809), and results apply to the active Roleplay chat rather than being attached as ordinary illustrations. (The Background agent only *selects* existing backgrounds — see the `background` entry.) *(v2.3)* Install-gated: until the Illustrator package is installed **and enabled per chat**, `/illustrate` and `/selfie` are hidden, image/video generation settings are hidden, and the Gallery Illustrate/Selfie/Storyboard/Video/Animate/Background actions are unavailable in every mode. Renames: selfie configuration is now **"Illustrator Settings"** (Chat Settings > Agents), the Connections defaults category "Illustrator" is now **"Images"**, and Game setup's "Visual Generation" is now Illustrator. *(v2.2)* The default Illustrator prompt rules were updated to carry available character **build, clothing/outfit, and appearance** details into the generated image prompt instead of leaving the image model to infer them. *(v2.1)* Distinct from the optional **Game Illustrator** "Dynamic LLM Prompt Generation" toggle (per-chat `gameImageDynamicPromptEnabled`; UI: Chat Settings > Agents > Illustrator), which asks the chat/prompt LLM to rewrite Game Mode NPC-portrait, location-background, and key-moment illustration prompts before image gen. GM-created NPC profile descriptions are rebuilt from current game state at asset-send time and sent as required canonical visual guidance for portrait prompts (preserved when generated avatars are written back to NPC metadata).
- **`lorebook-keeper`** (Lorebook Keeper — Misc) — auto-writes lorebook entries from the ongoing story.
- **`card-evolution-auditor`** (Card Evolution Auditor — Writer) — proposes character-card edits for user approval.
- **`spotify`** (Music DJ — Misc) — plays scene-matched music through **Spotify, YouTube, or local Game Assets** (`musicProvider` setting; *(v2.3)* Game Assets is the third source). *(v2.3)* The always-available **Music Player** toggle shows "Download Music DJ Agent to configure" guidance when the package isn't installed. *(v2.3.4)* The shared recent-track history now covers the last **250 Spotify tracks**, so 50-song candidate batches rotate across large playlists instead of repeating.
- **`cyoa`** (CYOA Choices — Misc) — generates in-character choices after a response. *(v2.4.0)* Choices gained a **Post/Impersonate quick toggle**, and centered choices now stay clear of the Tracker panel.
- **`haptic`** (Haptic Feedback — Misc) — drives haptic devices via Intiface Central running locally.
- **`long-term-memory`** (Long-Term Memory — Misc) — *(new to the catalog by v2.4.0)* durable cross-session recall. When it's active, its output reaches a custom agent only if that agent has the **`recalledMemories`** context source enabled (see "Per-agent context sources" below). *(v2.4.0)* Memory Recall discards superseded message revisions and injects only the current edited message text (#4304).
- **`storyboard`** (Storyboard — Misc) — *(new to the catalog by v2.4.0)* multi-panel scene storyboards. Distinct from Roleplay Gallery **Animate**, whose single-shot animation director is Illustrator-adjacent (see below).

### Feature packages (not pipeline agents)

These catalog packages ship package-owned server runtimes and surfaces instead of running as a phase in the agent pipeline (`execution: "feature"`):

- **`hierarchical-maps`** (Hierarchical Maps — Tracker) — *(v2.3)* nested world maps for Roleplay and Game; enableable in Roleplay and during/after Game creation. Its controls live nested inside its **Chat Settings > Agents** entry (#3679). *(2.3.3)* Fully obeys the Enable Agents master toggle; incompatible 1.0.x runtimes are quarantined (fixes "t.select is not a function"); a one-time correction removes the 2.3.2 migration's accidental Maps auto-selection (#3723); Maps calls in inactive chats no longer block sends ("Failed to flush 1 game-state patch callback").
- **`conversation-calls`** (Calls — Misc) — audio/video calls, moved into a package in v2.3.0 and renamed **"Calls"** user-facing in 2.3.2 (#3676; package IDs preserved). **Owns Local Whisper**: Connections shows the Local Speech Model controls only while the package is installed, and uninstalling removes downloaded Whisper models. #3671 fixed Whisper discovery when `DATA_DIR` is unset; package v1.0.4 stopped hardcoded fallback replies and dropped the provider-native JSON mode requirement (#3685). *(v2.3.4)* After a successful Local Whisper download, a notice asks you to **completely restart Marinara Engine** before use.
- **Six table games** (all Misc) — **`uno`** (UNO), **`chess`** (Chess), **`poker`** (Poker), **`eightball`** (8-Ball Pool), **`tic-tac-toe`** (Tic-Tac-Toe), **`rock-paper-scissors`** (Rock-Paper-Scissors) — Conversation feature packages with package-owned runtimes. They surface as **Commands toggles**, not Add Agent entries (no legacy `activeAgentIds`), and installed games hot-activate their slash commands **without an Engine restart** (2.3.2, #3699); route-bearing packages keep a safe restart path.

Each official pipeline agent has a default prompt template in `packages/shared/src/constants/agent-prompts.ts`. **Users can override any template** via the Agent Editor. *(v2.2)* When an overridden template is assembled as XML, **literal contract tags** the agent depends on (e.g. `<chat_summary>`, `<existing_entries>`) are honored verbatim; only values inserted through macros are escaped (#3548) — so a custom template can keep those structural tags intact without them being mangled.

**Phase overrides on built-ins (v2.1):** editing a built-in agent's phase in the Agent Editor is now honored in storage, normal generation, and manual retries — for Echo Chamber, Prose Guardian, Continuity, Immersive HTML, Expression, and Music DJ — instead of resetting to the built-in default. Agents like Prose Guardian and Continuity still **default** to `post_processing`, but a user's phase override now persists and takes effect. (Earlier docs describing these phases as fixed/force-pinned no longer apply.)

## Custom Agents

Users can create their own agents from scratch. The schema:

```typescript
{
  type: string,              // any string identifier
  name: string,              // display name
  description: string,
  phase: "pre_generation" | "parallel" | "post_processing",
  enabled: boolean,
  connectionId: string | null,  // separate LLM connection, optional
  resultType?: AgentResultType,  // optional; how the agent's output is applied (see below)
  imagePath: string | null,      // optional avatar/icon for the agent
  promptTemplate: string,    // the system prompt for this agent
  settings: object,          // arbitrary config
}
```

(The runtime `AgentConfig` also carries `id`, `tools`, `toolConfig`, and `createdAt`/`updatedAt`, which the server manages.)

**A custom agent is essentially a scoped LLM call with its own prompt, running in a specific phase.** The agent returns output in a structured form (depending on its `resultType`) — but as of v2.4.0 **what context it receives is opt-in per agent.**

### ⚠️ Per-agent context sources (v2.4.0, #4305) — read before designing any custom agent

Custom agents no longer receive the full turn context by default. Each agent declares which sources it wants, stored under `settings.contextSources` and edited in the Agent Editor's **Context Sources** control.

From `CUSTOM_AGENT_CONTEXT_SOURCE_IDS` / `DEFAULT_CUSTOM_AGENT_CONTEXT_SOURCES` (`packages/shared/src/types/agent.ts`):

| Source | Default | What it feeds |
|---|---|---|
| `chatHistory` | **`true`** | Recent messages, depth = the agent's `contextSize` setting |
| `characters` | `false` | The character card(s) in the chat |
| `persona` | `false` | The selected persona |
| `activatedLorebookEntries` | `false` | Lorebook entries that activated this turn |
| `chatSummary` | `false` | The chat summary |
| `authorNotes` | `false` | Author's Note |
| `trackerData` | `false` | Tracker panel state |
| `recalledMemories` | `false` | Long-Term Memory / vector recall results |

**Chat history is the only default. Everything else is off.** This is the single most common cause of a custom agent that "used to know the character" and now doesn't.

Enforcement, from `agent-executor.ts`:

```ts
return config.isCustomAgent ? normalizeCustomAgentContextSources(config.settings) : ALL_AGENT_CONTEXT_SOURCES;
```

Consequences worth stating to users:
- **Built-in / official package agents are unaffected** — they still get everything (`ALL_AGENT_CONTEXT_SOURCES`).
- An existing custom agent with no stored `contextSources` falls back to the defaults, i.e. chat-history-only. Upgrading can silently narrow an agent that previously reasoned over the card or lore.
- Turning `chatHistory` off forces `agentContextSize` to `0` — the agent sees no messages at all. That's valid for an agent driven purely by tracker state, but it's rarely what someone wants by accident.
- `recalledMemories` is what connects the Long-Term Memory package to a custom agent. Without it, memory recall never reaches the agent.

**When recommending a custom agent, always name the context sources it needs.** "Create a continuity agent" is incomplete advice; "create a continuity agent with `characters`, `activatedLorebookEntries`, and `chatSummary` enabled" is actionable.

Design implication: narrower context is cheaper and more focused. Enable only what the agent's job requires rather than switching everything on reflexively — that's the point of the feature.

### Result types (what the agent returns)

From `agentResultTypeSchema` (`packages/shared/src/schemas/agent.schema.ts`). The field is **`resultType`** (optional). The full set — 28 values as of v2.3.4 (`local_music_control` and `about_me_update` added since the 26-value v2.0 set):

- *Text / prompt:* `text_rewrite`, `context_injection`, `prompt_patch`
- *Trackers & cards:* `character_tracker_update`, `custom_tracker_update`, `persona_stats_update`, `character_card_update`, `lorebook_update`
- *Narrative / continuity:* `continuity_check`, `director_event`, `secret_plot`, `quest_update`
- *Media / scene:* `image_prompt`, `background_change`, `sprite_change`, `echo_message`, `spotify_control`, `youtube_control`, `local_music_control` (local Game Assets music source), `haptic_command`, `frontend_theme_update`

> *(v2.4.0, #4337)* A custom agent whose `resultType` is **`image_prompt`** now gets the full **Illustrator-style control set**: image connection, reference image, appearance, and prompt controls. Previously these were exclusive to the Illustrator package. This makes `image_prompt` the practical route for "I want my own image agent with different framing rules" without forking Illustrator — recommend it instead of a webhook-to-your-own-image-backend for that use case.
- *Game Mode:* `game_state_update`, `game_state_transition`, `game_master_narration`, `game_map_update`, `party_action`, `cyoa_choices`
- *Conversation:* `about_me_update`

**Removed in v2.0:** `chat_summary` and `prompt_review` are no longer result types.

**Most user-defined agents** use `context_injection` (or leave `resultType` unset and just return text to inject) — the flexible option that works for the majority of custom agents.

### Tool-using agents

Agents can call tools too — the agent executor supports tool-calling loops. An agent with `toolContext` set can make tool calls, receive results, and continue until it's done. This allows custom agents to do things like "look up current weather, then inject that as world state context."

See `packages/server/src/services/agents/agent-executor.ts` for the loop implementation.

### Custom agent capabilities (v2.0)
Custom agents have an explicit capability model — `CUSTOM_AGENT_CAPABILITY_IDS` (`packages/shared/src/types/agent.ts`): `create_lorebooks`, `edit_lorebooks`, `edit_messages`, `edit_trackers`, `change_frontend_styling`, `trigger_image_generation`, `access_vectors`, `edit_main_prompt`. These gate what an agent is allowed to do and are derived from the agent's `resultType`, its enabled tools, and `settings.customCapabilities`.

### Turn Data Access (v2.0)
Post-processing agents can **opt in** to see the current turn's data: `preGenInjections` (what pre-generation agents injected) and `parallelResults` (parallel-phase results). It's off by default — only opted-in agents receive it (`AgentContext.preGenInjections` / `parallelResults`).

### Game Mode & mode gating
v2.0 added **Game-Mode custom-agent selection** in Chat Settings (the picker sits at the bottom of the Agents section). *(v2.3)* Selected **custom agents now run in all three modes** — Conversation, Roleplay, and Game — whenever the chat's Enable Agents master toggle is on (#3692). `modeAllowlist`-style per-mode gating applies **only to official packages**, surfaced as the Conversation/Roleplay/Game compatibility badges in Download Agents — so not every official agent is offered in every mode.

**(v2.1)** Game Mode also exposes per-chat **media prompt preset** selectors in Chat Settings > Agents — Illustration Prompt, Animation Prompt, and Game Video Prompt — with read-only built-ins (Still Keyframes, Comic Page, Colored Manga, B&W Manga, Cinematic Scene Video) that users copy into chat-local editable versions. These pair with the Game Illustrator toggle (see the `illustrator` entry above). The full media-preset doc lives in architecture.md.

**(v2.2)** A registered **Noodle Timeline Voice & Tone** prompt override (Settings > Generations > Image Generation Prompt Overrides) lets the tone/creative-freedom portion of Noodle's refresh prompt be user-rewritten, while its structured-action and output-format rules stay hardcoded outside the override so a rewrite can't break refresh generation. Noodle isn't an agent — see references/architecture.md for the Noodle refresh pipeline.

### Exporting & importing agents (v2.0)
Custom agents export/import as a single JSON payload **or** as a **folder/zip package** (`packages/client/src/lib/agent-transfer.ts`), so a complex agent can travel with related files/code instead of just one JSON blob.

*(v2.3.4)* Import/export is hardened (#3953): exports **no longer bundle custom function definitions**, and an imported agent file can no longer install bundled custom functions, grant itself tool access, or overwrite a curated agent by reusing its internal `type`. Imports land under a fresh custom identity (`custom-import-<slug>-<suffix>`), and the recipient must review the agent and **explicitly re-attach any tools** — so recommendations involving shared agent files should include that re-attach step.

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
- A "relationship tracker" that updates a custom JSON state each turn
- A "foreshadowing director" that injects subtle plot hints when specific conditions are met

### Bad custom agent candidates
- "Call my API to look up X" — use a tool instead; agents shouldn't be doing user-requested actions.
- "Remember things the user says" — use semantic memory (built-in) or lorebook-keeper, not a custom agent.
- "Rewrite every message to be more dramatic" — prose-guardian already does this flavor of work, probably better than your custom agent will.
- "Respond as a different character" — that's not an agent, that's a group chat.

## Tuning and Pitfalls

### Stacking too many agents
Every enabled agent costs a separate LLM call. A chat with 8 agents enabled will make 9 total LLM calls per turn (8 agents + the main response). Token cost and latency add up fast.

**Recommendation for most characters:** 0–3 agents. More only if the project specifically benefits.

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

The built-in Gemma 4 E2B sidecar is specifically designed to handle tracker agents locally, keeping tokens off your main provider bill. *(v2.3.4)* After a successful local Gemma model download, a notice asks you to **completely restart Marinara Engine** before use.

### Conflicting agents
If you enable both `world-state` and a custom tracker that also manages location/weather, they can step on each other. Disable one, or use the `custom-tracker` with locked fields. *(v2.1)* Roleplay/Game trackers support locking individual fields, and tracker / custom-agent update agents respect per-field locks — a locked field can't be bypassed by an AI update that renames or replaces the locked row at the same position.

### Agent prompt templates
Default templates are decent but generic. For production use, customize the `promptTemplate` to match your specific style, genre, or constraints. The default prompts are in `packages/shared/src/constants/agent-prompts.ts` — reading them gives a good starting point for custom variants.

### Debugging agents
- The Agent Editor shows the agent's last run and output.
- Enable verbose logging if the agent seems to misbehave.
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
- `GET /echo-messages/:chatId`, `DELETE /echo-messages/:chatId` — echo-chamber output
- `GET /runs/:chatId`, `GET /runs/:chatId/custom`, `PATCH /runs/:runId`, `DELETE /runs/:chatId` — agent run records
- `GET /cadence/:agentType/:chatId` — run-cadence state
- `GET /memory/:agentType/:chatId`, `DELETE /memory/:agentType/:chatId` — agent memory

## UI Location

**Agents Panel** (right sidebar → sparkles icon). *(v2.3)* Lists **installed packages** (catalog artwork, star fallback when art is missing) plus the **Download Agents** entry point, alongside the Custom Tools subsection; uninstalling a package refreshes the open sidebar immediately. Each agent has a full editor for its prompt, connection override, and settings. **Chat Settings > Agents** stays available in all three modes even with nothing installed — empty sections (and the empty setup-wizard Agents step) link to Download Agents, and built-in Conversation commands remain configurable without any downloads.

### Agent Suite (v2.1)
Opened from the **Chat Settings drawer's Agents section**, the Agent Suite lists the agents active in the current chat and lets you view and edit everything they have **stored** — agent memory, tracker state (Scene / Present Characters / Active Quests slices), and custom-agent outputs. Edits can be made **manually** or via **AI-assisted rewrites**: select text (or rewrite-all), give an instruction, optionally add grounding via the **Add Context** picker (character cards / active-lorebook entries, max 20 sources / 100k chars), and choose a connection. It reads/writes the existing `/api/agents/memory` and `/runs` endpoints (source: `AgentSuiteModal.tsx`).
