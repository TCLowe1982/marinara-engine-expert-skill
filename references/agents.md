# Agents

Agents are **autonomous LLM sub-systems that run during message generation**. They handle side tasks like state tracking, prose quality enforcement, continuity checking, image generation, and music control — running before, alongside, or after the main response.

All agents are **disabled by default**. Users enable only what they need. Each enabled agent adds latency and token cost per turn, so the right recommendation is usually the minimum viable set.

**Source of truth:** `packages/server/src/services/agents/` (agent-executor.ts, agent-pipeline.ts, knowledge-retrieval.ts), `packages/shared/src/schemas/agent.schema.ts`, `packages/shared/src/constants/agent-prompts.ts` (default prompt templates for built-ins).

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

## Built-In Agents

There are **21 built-in agents** (registry: `packages/shared/src/features/agents/agent-registry.generated.ts`; canonical ids in `BUILT_IN_AGENT_IDS`, `packages/shared/src/types/agent.ts`). Listed by phase, with the `id` you reference in config and the display name.

> **Retired — don't reference these:** `prompt-reviewer`, `response-orchestrator`, `schedule-planner`, `chat-summary`, `autonomous-messenger`, `youtube`, `secret-plot-driver` are in `RETIRED_BUILT_IN_AGENT_IDS` and are no longer built-ins. (Chat summary survives only as a prompt constant, not an agent.)

### Pre-generation
- **`director`** (Narrative Director) — pacing directives, dramatic beats, scene transitions.
- **`knowledge-retrieval`** (Knowledge Retrieval) — embedding-based semantic search across lorebook entries / knowledge sources; closest thing to traditional RAG.
- **`knowledge-router`** (Knowledge Router) — lower-cost RAG alternative: selects relevant lorebook entries by ID and injects them directly.
- **`html`** (Immersive HTML) — formats messages with custom HTML/CSS. `runtimeDisabled`: it injects formatting into the last user prompt rather than running as a separate agent call.

### Parallel
- **`echo-chamber`** (Echo Chamber) — absent characters / sidebar reactions to the current scene.
- **`combat`** (Combat) — turn-based combat mechanics computed alongside narration.

### Post-processing
- **`prose-guardian`** (Prose Guardian) — repetition analysis, rhetorical-device selection, sentence variety, sensory rotation. *Phase-locked to post_processing.*
- **`continuity`** (Continuity Checker) — flags/repairs contradictions with established lore. *Phase-locked to post_processing.*
- **`world-state`** (World State) — tracks date/time, weather, location, and present characters.
- **`character-tracker`** (Character Tracker) — present characters, moods, relationships, appearance/outfit, stats.
- **`custom-tracker`** (Custom Tracker) — user-defined tracking (any JSON state).
- **`persona-stats`** (Persona Stats) — updates player/character RPG stats.
- **`quest`** (Quest Tracker) — quest objectives, completion, rewards.
- **`expression`** (Expression Engine) — picks character sprite expressions from emotional content.
- **`background`** (Background) — picks/generates the scene background image.
- **`illustrator`** (Illustrator) — generates scene illustrations via an image provider (default `runInterval: 5`).
- **`lorebook-keeper`** (Lorebook Keeper) — auto-writes lorebook entries from the ongoing story.
- **`card-evolution-auditor`** (Card Evolution Auditor) — proposes character-card edits for user approval.
- **`spotify`** (Music DJ) — suggests/controls music for the scene; supports both Spotify and YouTube via the `musicProvider` setting.
- **`cyoa`** (CYOA Choices) — generates in-character choices after a response.
- **`haptic`** (Haptic Feedback) — drives haptic devices via Intiface Central running locally.

Each built-in has a default prompt template in `packages/shared/src/constants/agent-prompts.ts`. **Users can override any template** via the Agent Editor.

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

**A custom agent is essentially a scoped LLM call with its own prompt, running in a specific phase.** The agent gets context about the current chat and is expected to return output in a structured form (depending on its `resultType`).

### Result types (what the agent returns)

From `agentResultTypeSchema` (`packages/shared/src/schemas/agent.schema.ts`). The field is **`resultType`** (optional). The full v2.0 set (26 values):

- *Text / prompt:* `text_rewrite`, `context_injection`, `prompt_patch`
- *Trackers & cards:* `character_tracker_update`, `custom_tracker_update`, `persona_stats_update`, `character_card_update`, `lorebook_update`
- *Narrative / continuity:* `continuity_check`, `director_event`, `secret_plot`, `quest_update`
- *Media / scene:* `image_prompt`, `background_change`, `sprite_change`, `echo_message`, `spotify_control`, `youtube_control`, `haptic_command`, `frontend_theme_update`
- *Game Mode:* `game_state_update`, `game_state_transition`, `game_master_narration`, `game_map_update`, `party_action`, `cyoa_choices`

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
v2.0 added **Game-Mode custom-agent selection** in Chat Settings (the picker sits at the bottom of the Agents section). Built-ins are also mode-gated via `modeAllowlist` (e.g. `cyoa`/`combat`/`world-state` → roleplay/visual-novel; `director`/`html` → roleplay-only), so not every agent is offered in every mode.

### Exporting & importing agents (v2.0)
Custom agents export/import as a single JSON payload **or** as a **folder/zip package** (`packages/client/src/lib/agent-transfer.ts`), so a complex agent can travel with related files/code instead of just one JSON blob.

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

### Choosing the agent's LLM
Each agent can have its own `connectionId`. Useful patterns:
- Use a **cheap/fast model** (Gemma sidecar, GPT-4o mini, Haiku) for trackers and extractors.
- Use the **main model** for prose-guardian, continuity, and anything that needs literary sensitivity.
- Use a **vision-capable model** for agents that need to see generated images (rare).

The built-in Gemma 4 E2B sidecar is specifically designed to handle tracker agents locally, keeping tokens off your main provider bill.

### Conflicting agents
If you enable both `world-state` and a custom tracker that also manages location/weather, they can step on each other. Disable one, or use the `custom-tracker` with locked fields.

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

**Agents Panel** (right sidebar → sparkles icon). Shows built-in agents (with toggles and editable prompt templates) and a Custom Tools subsection. Each agent has a full editor for its prompt, connection override, and settings.
