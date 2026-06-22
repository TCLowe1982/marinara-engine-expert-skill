# Marinara Engine: Architecture Overview

Marinara Engine is a local-first AI roleplay and chat frontend. Users run it on their own machine (Windows installer, Docker, Node.js clone, or Termux on Android), plug in their own AI API keys (OpenAI, Anthropic, Google, OpenRouter, Mistral, Cohere, or any OpenAI-compatible endpoint), and chat with AI characters.

Repo: https://github.com/Pasta-Devs/Marinara-Engine
Built by SpicyMarinara & Pasta-Devs. License: AGPL-3.0.

## The Big Picture

```
┌─────────────────────────────────────────────────────────────┐
│  Client (React / Tailwind v4, PWA-capable)                  │
│  - Chat UI  - Agents panel  - Lorebook editor  - Extensions │
└──────────────────────────────┬──────────────────────────────┘
                               │ fetch /api/*
┌──────────────────────────────┴──────────────────────────────┐
│  Server (Fastify, TypeScript, SQLite via Drizzle ORM)       │
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
│  SQLite DB: messages, chats, characters, personas,          │
│  lorebooks, presets, agents, custom-tools, etc.             │
└─────────────────────────────────────────────────────────────┘
```

## The Core Objects

### Character
A persona the user chats with. Follows the V2 character card spec. Stored as JSON in SQLite. Fields include `name`, `description`, `personality`, `scenario`, `first_mes`, `system_prompt`, plus Marinara-specific extensions (appearance, backstory, name/dialogue colors, schedule, etc.). Can be created in the app, imported from SillyTavern, imported from PNG files with embedded metadata, or browsed from Chub.ai via the Bot Browser.

See `references/character-cards.md`.

### Persona
The user's own identity in chats. Same shape as characters but simpler. Has name, description, personality, appearance, avatar, and optional custom colors. Multiple personas per user; the active persona is substituted for `{{user}}` macros in prompts.

### Lorebook
A keyword-triggered knowledge base. Entries have `keys` (trigger words), `content` (what gets injected when a key is matched in recent chat context), and a bunch of tuning knobs (sticky, cooldown, delay, selective, grouped, recursive). Can be global, per-character, or per-chat.

See `references/lorebooks.md`.

### Preset
A full prompt configuration for roleplay chats. Controls the order and content of system prompt sections, generation parameters (temperature, top-p, max tokens), and optional choice blocks.

### Connection
An API configuration pointing at an LLM provider: provider name, API key (encrypted at rest with AES-256), model, base URL, max context length. Users need at least one connection to chat. Per-chat overrides are supported.

### Agent
An autonomous LLM sub-system that runs during generation. 25 built-ins plus user-defined custom agents. Each agent has a phase (pre/parallel/post), a system prompt, an optional dedicated connection, and settings. All disabled by default — users enable only what they need.

See `references/agents.md`.

### Custom Tool
A user-defined function the main chat model can call during generation. Three execution types: `static` (hardcoded response), `webhook` (POST to a URL), `script` (sandboxed JS, no network). Exposed to the model as OpenAI-compatible function definitions.

See `references/custom-tools.md`.

### Extension
Client-side CSS + JS loaded at runtime. Gets a scoped `marinara` API for DOM injection, event handling, and calling the Marinara server's own API.

See `references/extensions.md`.

### Professor Mari (built-in assistant)
Marinara's built-in assistant, seeded at first run and not deletable. **As of v2.0 she is the Home-screen assistant** (no longer a normal Conversation-mode character): users talk to her from the Home screen, where a Pi-backed *workspace agent* can inspect the local app and — with browser approval for database changes — create content (characters, personas, lorebooks, chats) and navigate panels. She replaced the standalone character/persona/lorebook *maker* modals and their generation routes, removed in v2.0.

See `references/character-cards.md` → The Professor Mari Pattern, and `docs/PROFESSOR_MARI.md`.

## Chat Modes

Marinara has three chat modes. Each has a different prompt assembly pipeline and UI.

### Conversation Mode 💬
Discord-style DMs. Casual text, no asterisks, no narration. Characters have:
- **Schedules** — weekly timetables of activities, generated by an LLM based on personality
- **Statuses** — derived from schedule: online, idle, dnd (do-not-disturb), offline
- **Talkativeness** — 0–1, affects autonomous messaging rate
- **Selfies** — characters can emit `[selfie]` to generate a selfie-style image
- **Memory commands** — characters can send memories to other characters via `[memory: target="..."]`
- **Scenes** — conversation characters can initiate temp roleplay chats via `[scene: ...]`

Group DMs are supported — a Response Orchestrator agent picks who speaks next.

### Roleplay Mode 🎭
Traditional creative-writing roleplay. Rich narration, prose. Supports:
- Full agent stack (world state, trackers, sprites, backgrounds, weather, combat)
- VN-style character sprite overlays (up to 3 visible)
- Custom backgrounds with crossfade transitions
- Weather particle effects (rain, snow, thunderstorm, fog, cherry blossoms, aurora)
- Time-of-day lighting (dawn, day, dusk, night)
- Game HUD with character stats, quests, world state

### Game Mode 🎮 (coming soon, partially live in v1.5.x)
Roleplay + JRPG game loop. The model acts as GM; the engine handles mechanics. State machine with `exploration`, `dialogue`, `combat`, `travel_rest`. Tactical combat UI, dice rolls, skill checks, reputation, elemental reactions, quest tracking, auto-journaling.

## Prompt Assembly (Simplified)

For a roleplay turn, the system prompt is assembled roughly as:

1. **Preset sections** (ordered, user-configurable) — typically:
   - System role / jailbreak
   - Character description + personality + scenario
   - Persona description
   - World info / lorebook entries (injected based on keyword matches in recent messages)
   - Examples of dialogue
   - Chat summary (if enabled and conversation is long)
   - Connected-chat awareness (if this chat is linked to another)
   - Agent injections (from pre-generation agents)
2. **Recent message history** — the chat's last N messages
3. **Depth-injected prompts** — special prompts inserted at specific depths in the history
4. **Final instructions / post-history instructions**

For conversation mode, assembly is simpler: system prompt (mode-specific framing + character card) + name lists + fetched context + message history.

The assembly lives in `packages/server/src/routes/generate.routes.ts` (6,800+ lines) and `packages/server/src/routes/generate/` helpers. It is **not user-extensible without forking**.

## Data Storage

Single SQLite file (default: `data/marinara-engine.db`). All user data lives here:
- chats, messages, chat_folders
- characters, personas, groups, persona_groups
- lorebooks, lorebook_entries
- presets, regex_scripts
- connections (with encrypted API keys)
- agents (both built-in configs and custom agents)
- custom_tools
- themes
- gallery (generated images)

Fully local. Backing up = copying the `.db` file. Sharing = exporting individual objects as JSON (characters, presets, lorebooks all have export endpoints).

## API Surface (Key Endpoints)

All under `/api/*`:
- `/api/characters` — CRUD, groups, import/export (JSON/PNG)
- `/api/personas` — (within characters routes)
- `/api/lorebooks` — CRUD, entries, export
- `/api/presets` (`/api/prompts`) — CRUD, sections, choice blocks
- `/api/connections` — CRUD, duplicate, test
- `/api/agents` — CRUD, toggle, echo messages
- `/api/custom-tools` — CRUD
- `/api/generate` — main SSE generation endpoint with the full agent pipeline
- `/api/chats` — CRUD, messages, connect/disconnect
- `/api/scene` — create/plan/conclude scene branches
- `/api/conversation` — schedule, status, autonomous message checks
- `/api/encounter` — combat init/action/summary
- `/api/professor-mari/workspace` — Professor Mari's workspace agent: AI-assisted creation of characters/personas/lorebooks/chats. **This replaced the standalone `/api/character-maker`, `/api/lorebook-maker`, and `/api/persona-maker` routes, which were removed in v2.0.**
- `/api/bot-browser/*` — import from Chub, CharacterTavern, JannyAI, Pygmalion, Wyvern

Full list in `docs/FRONTEND.md`.

## Providers Supported

- OpenAI, Anthropic, Google, Mistral, Cohere, OpenRouter, NanoGPT
- Any custom OpenAI-compatible endpoint (use "Custom" provider)
- Local: Google Gemma 4 E2B built in via MLX sidecar (macOS Apple Silicon) or standard sidecar elsewhere — mainly for tracker agents & scene analysis
- Image gen: Pollinations, Stability AI, Together AI, NovelAI, ComfyUI (with custom workflows), AUTOMATIC1111

## Special Features Worth Knowing

- **Cross-chat awareness** — when the user mentions "yesterday," "last week," etc., the system retrieves relevant messages from the character's other chats and injects them as `<awareness>` XML.
- **Semantic memory (message RAG)** — messages are chunked (5 at a time), embedded with `all-MiniLM-L6-v2` running locally, and retrieved by cosine similarity. Top 8 chunks with threshold filtering, toggle per-chat.
- **Regex scripts** — user-defined find/replace that runs on inputs and/or outputs, for formatting cleanup or custom macro systems.
- **Macros** — `{{char}}`, `{{user}}`, `{{time}}`, `{{date}}`, `{{random::a,b,c}}`, and more in prompts.
- **Connected chats** — conversation ↔ roleplay bidirectional links with `<influence>` (conversation → RP) and `<ooc>` (RP → conversation) tags.
- **Spotify integration** — a Spotify DJ agent can control playback via built-in tools (`spotify_play`, `spotify_search`, etc.) to score the scene.
- **Discord webhook mirror** — per-chat Discord webhook that mirrors user and AI messages.
- **Love Toys integration** — Buttplug.io haptic device control via a dedicated agent (yes, really; it's in the README).

## What's NOT Built-In

Important for recommendations:
- No native external vector DB integration (lorebook uses local embeddings only).
- No plugin marketplace — extensions are manual CSS/JS install.
- No hooks into the prompt assembly pipeline — can't insert your own logic mid-generation without forking.
- No multi-user auth — it's single-user / local-first by design. Multi-user requires a proxy + auth layer you build.
- Script tools have no network, no filesystem, no `require`. Pure JS computation only.
- No built-in way to add new chat modes.
- No native GraphQL, no tRPC, no realtime subscriptions beyond SSE for generation.

If the user needs any of these, the answer is usually "webhook tool to your own backend" or "fork the engine."
