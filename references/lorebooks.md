# Lorebooks

Lorebooks are **keyword-triggered knowledge injection** for characters and chats. Each lorebook contains entries; each entry has trigger keywords and content. When recent chat messages contain a keyword, the entry's content is injected into the prompt.

This is the right tool for **large, structured, but stable** reference knowledge that would waste tokens if always-on.

**Source of truth:** `packages/shared/src/schemas/lorebook.schema.ts`.

## Concepts

A **lorebook** is a container with:
- A name, description, category (`world` / `character` / `npc` / `spellbook` / `uncategorized`)
- A `tokenBudget` — maximum tokens of entries that can be injected per turn (default 2048)
- A `scanDepth` — how many recent messages to scan for keywords (default 2)
- `recursiveScanning` — if true, activated entries' content is itself scanned for more triggers
- `maxRecursionDepth` — cap on recursion (default 3, max 10)
- Scope: `isGlobal`, per-character (`characterId` / `characterIds[]`), per-persona (`personaId` / `personaIds[]`), or per-chat (`chatId` / `scope` object) — see the Scope section below
- Also: `entryLimit`, `imagePath`, `tags`, a whole-lorebook `excludeFromVectorization` ("No Vector"), and provenance (`generatedBy`, `sourceAgentId`)

An **entry** is the actual knowledge chunk with:
- `name` — human-readable label
- `content` — what gets injected into the prompt
- `keys` — primary trigger words/regexes
- `secondaryKeys` — additional triggers
- Activation rules (constant, selective, probability, conditions, schedule)
- Timing (sticky, cooldown, delay, ephemeral)
- Grouping and priority (group, groupWeight, order)
- Position (before or after character description; depth within history)
- Matching options (whole-word, case-sensitive, regex)

## Entry Fields (Full Reference)

From `createLorebookEntrySchema`:

| Field | Type | Default | What it does |
|---|---|---|---|
| `name` | string | required | Display name in the UI. Not sent to model. |
| `content` | string | `""` | The text injected when triggered. |
| `keys` | string[] | `[]` | Primary trigger keywords. Matching any triggers the entry. |
| `secondaryKeys` | string[] | `[]` | Additional triggers, used with `selective` + `selectiveLogic`. |
| `enabled` | bool | `true` | Master on/off. |
| `constant` | bool | `false` | **If true, ALWAYS injected** (no keyword needed). Use sparingly. |
| `selective` | bool | `false` | If true, combines primary and secondary keys via `selectiveLogic`. |
| `selectiveLogic` | `and`, `and_all`, `or`, `not`, `not_all` | `"and"` | How primary/secondary keys combine when `selective`. `and` = primary + at least one secondary; `and_all` = primary + **all** secondary keys; `or` = either; `not`/`not_all` negate. |
| `probability` | number | `null` | 0-1 chance of firing even when triggered. |
| `scanDepth` | number | `null` | Overrides the lorebook's scan depth for this entry. |
| `matchWholeWords` | bool | `false` | If true, `king` won't match `kingdom`. |
| `caseSensitive` | bool | `false` | If true, `King` ≠ `king`. |
| `useRegex` | bool | `false` | Treat `keys` as regex patterns instead of plain strings. |
| `position` | 0, 1, or 2 | `0` | 0 = before character description, 1 = after, 2 = inject at message `depth`. |
| `depth` | number | `4` | How many messages deep to inject (for `@depth` positioning). |
| `order` | number | `100` | Insertion order within same position/group. Lower = earlier. |
| `role` | `"system" | "user" | "assistant"` | `"system"` | What role to attribute the injection to. |
| `sticky` | number | `null` | Stay active for N messages after last trigger. |
| `cooldown` | number | `null` | Minimum messages between activations. |
| `delay` | number | `null` | Wait N messages before first activation in a chat. |
| `ephemeral` | number | `null` | Only active for N total activations per chat. |
| `group` | string | `""` | Group name. Entries in same group compete by weighted lottery. |
| `groupWeight` | number | `null` | Weight for intra-group competition. |
| `preventRecursion` | bool | `false` | Don't trigger further entries from this one's content. |
| `locked` | bool | `false` | Protect from agent edits (e.g., Lorebook Keeper). |
| `tag` | string | `""` | Freeform category tag. |
| `relationships` | object | `{}` | Cross-entry references (for graph-style lore). |
| `dynamicState` | object | `{}` | Per-chat mutable state. |
| `activationConditions` | array | `[]` | Game-state gates (`field`, `operator`, `value`). |
| `schedule` | object | `null` | Time/date/location gating for game mode. |
| `description` | string | `""` | Optional entry description (UI only). |
| `excludeFromVectorization` | bool | `false` | "No Vector" — skip this entry in semantic embedding. |
| `excludeRecursion` | bool | `false` | This entry can't be activated *by* recursion. |
| `delayUntilRecursion` | bool | `false` | This entry only activates *during* recursion. |
| `folderId` | string | `null` | Folder this entry belongs to (a folder can be toggled to gate all its entries). |
| `characterFilterMode` / `characterFilterIds` | enum / string[] | `"any"` / `[]` | Restrict activation to specific characters. |
| `characterTagFilterMode` / `characterTagFilters` | enum / string[] | `"any"` / `[]` | Restrict by character tags. |
| `generationTriggerFilterMode` / `generationTriggerFilters` | enum / string[] | `"any"` / `[]` | Restrict by generation trigger (see Trigger types below). |
| `additionalMatchingSources` | string[] | `[]` | Also scan extra fields for keys: character name/description/personality/scenario/tags, persona description/tags. |

## Generation Trigger Types & Folders

Entries can be gated by **which generation triggered them** via `generationTriggerFilters` (+ `generationTriggerFilterMode`): `chat` (Chat reply), `continue`, `autonomous`, etc. Note (1.6/2.0): guided `/guided` and guided manual replies now fire **Chat reply** triggers — so if an entry should fire on guided replies, set its trigger to `chat`, not Continue/Autonomous.

Entries can also live in **folders** (`folderId`); toggling a folder gates every entry inside it. And `additionalMatchingSources` lets an entry's keys also match against character/persona fields (name, description, personality, scenario, tags), not just recent chat messages.

## Common Entry Patterns

### Always-on entry (use sparingly)
```json
{
  "name": "Setting Overview",
  "constant": true,
  "content": "The story is set in a cyberpunk Seoul, 2087. Megacorps rule; AI is illegal."
}
```
Constant entries burn tokens every turn. Keep them short.

### Keyword-triggered entry (the default case)
```json
{
  "name": "Dr. Kim",
  "keys": ["Dr. Kim", "doctor Kim", "Kim Ji-ho"],
  "content": "Dr. Kim Ji-ho, 42, black-market cyberneticist. Works out of a basement clinic in Gangnam."
}
```
Injected only when any of the keys match recent messages.

### Regex entry for flexible matching
```json
{
  "name": "Dragon Lore",
  "keys": ["dragon\\w*", "\\bwyrm\\b"],
  "useRegex": true,
  "matchWholeWords": false,
  "content": "Dragons in this world are extinct except for five known survivors..."
}
```

### Selective entry (primary AND at least one secondary must match)
```json
{
  "name": "Combat with Kim",
  "keys": ["Dr. Kim"],
  "secondaryKeys": ["fight", "attack", "combat", "gun"],
  "selective": true,
  "selectiveLogic": "and",
  "content": "In combat, Dr. Kim prefers non-lethal neural disruptors; he won't kill unless cornered."
}
```

Here `selectiveLogic: "and"` means the primary key matched **and at least one** secondary key matched. Use `and_all` if you need **every** secondary key present.

### Grouped entries (one-of-N weighted lottery)
```json
[
  { "name": "Random Weather: Rain", "group": "weather", "groupWeight": 3, "constant": true, "content": "It's raining." },
  { "name": "Random Weather: Fog", "group": "weather", "groupWeight": 1, "constant": true, "content": "Heavy fog." },
  { "name": "Random Weather: Clear", "group": "weather", "groupWeight": 6, "constant": true, "content": "Clear skies." }
]
```
Of the group members whose triggers fire, only one is chosen, weighted by `groupWeight`.

### Sticky entry (stays around after trigger)
```json
{
  "name": "In the cave",
  "keys": ["enter the cave", "cave mouth"],
  "content": "The party is inside the Echoing Cave. It's dark and damp. Every sound echoes.",
  "sticky": 10
}
```
Once triggered, stays active for 10 more messages even without the keyword repeating.

### Ephemeral entry (limited uses)
```json
{
  "name": "First meeting surprise",
  "keys": ["Marcus"],
  "content": "Marcus is surprised to see the player — he thought they were dead.",
  "ephemeral": 1
}
```
Fires at most once per chat, then disables itself.

## Scope: Global, Character, Persona, Chat

Scope is controlled by several fields on the lorebook (`packages/shared/src/schemas/lorebook.schema.ts`) — **not** by "both ids null":
- **`isGlobal: true`** — global. Attached to all chats where enabled in prompt settings.
- **`characterId`** (single) or **`characterIds: []`** (multiple) — character-scoped. Active only in chats including that character. (Use one field or the other, not both.)
- **`personaId`** (single) or **`personaIds: []`** (multiple) — persona-scoped (new in v2.0). Active when that persona is in use.
- **`chatId`** plus the **`scope`** object `{ mode: "all" | "disabled" | "specific", chatIds: [] }` — chat targeting.

A `superRefine` enforces that a global lorebook (`isGlobal: true`) **cannot also** target specific characters or personas — pick global *or* scoped.

**When to use which:**
- World lore, shared universes → `isGlobal`.
- Character's personal memories, backstory depth → character-scoped.
- Persona-specific knowledge (about the user's role) → persona-scoped.
- Current scene state, one-session plot flags → chat-scoped.

## Token Budget Management

The lorebook's `tokenBudget` caps total injected content per turn. If more entries match than fit, lower-`order` entries inject first (constant entries and group weighting also factor in); entries that don't fit are skipped — the World Info Inspector surfaces which were budget-skipped (a 1.6/2.0 visibility feature).

**Practical sizing:**
- For casual characters: 500–1000 tokens budget.
- For rich worldbuilding: 2000–4000 tokens budget.
- Past ~4000 is usually a sign you should split into multiple lorebooks or use semantic memory (RAG over messages).

## Recursive Scanning

If `recursiveScanning` is true, the content of activated entries is itself scanned for triggers. This enables "chained" lore — entry A triggers, mentions B, B triggers, mentions C, etc. — up to `maxRecursionDepth`.

**When to use:**
- Complex fictional worlds where entries cross-reference each other.
- When you want mentioning one character to bring in their faction, their location, their history.

**When to avoid:**
- Small lorebooks (wastes compute, no benefit).
- Performance-sensitive chats (recursion has real cost).
- When entries are deliberately isolated (e.g., separate factions that shouldn't leak into each other).

**Mitigation:** use `preventRecursion: true` on specific entries to stop them from triggering further chains.

## Knowledge Retrieval, Router & Sources (Semantic Matching)

Three related v2.0 surfaces handle "the user mentioned a concept without the exact keyword":

- **Knowledge Retrieval** (`knowledge-retrieval` built-in agent, pre-generation) — embedding-based semantic search (local `all-MiniLM-L6-v2` embeddings) over selected lorebooks **and uploaded knowledge-source files**; injects the relevant matches. Complementary to keyword matching.
- **Knowledge Router** (`knowledge-router` built-in agent, pre-generation) — a lower-cost alternative that **selects relevant lorebook entries by ID** and injects them directly, rather than doing full embedding search.
- **Knowledge Sources** (`/api/knowledge-sources`) — upload text files / PDFs that the Knowledge Retrieval agent can scan alongside lorebooks.

**Embeddings:** entries are embedded via a configured **embedding connection** (e.g. the Local Model sidecar's `/api/sidecar/v1/embeddings`); per-entry `excludeFromVectorization` (and the lorebook-level "No Vector") opt entries out. Embedding isn't purely automatic — it depends on having an embedding source configured.

## Activation Conditions (Game-State Gating)

Entries can require game-state conditions to fire:
```json
{
  "name": "Forest Encounter",
  "keys": ["forest"],
  "content": "...",
  "activationConditions": [
    { "field": "time", "operator": "equals", "value": "night" },
    { "field": "location", "operator": "contains", "value": "forest" }
  ]
}
```
Both conditions must match (AND logic) for the entry to fire. Useful for Game Mode where the World State agent tracks live game state.

## Schedule (Time/Date/Location)

For time-based gating:
```json
{
  "schedule": {
    "activeTimes": ["night", "midnight"],
    "activeDates": ["2024-12-25"],
    "activeLocations": ["castle"]
  }
}
```

## AI-assisted lorebook creation (Professor Mari)

> **Changed in v2.0:** the standalone `lorebook-maker` modal and its `POST /api/lorebook-maker/generate` route were **removed**. AI-assisted lorebook creation now goes through **Professor Mari**, Marinara's Home-screen assistant — ask her to "make a lorebook from these notes" and she creates it (optionally with starter entries) via the workspace agent (`POST /api/professor-mari/workspace`). See `references/character-cards.md` → The Professor Mari Pattern. Don't tell users to open a "Lorebook Maker" / "AI generator" button; it no longer exists.

**When to use:** to bootstrap a lorebook from a summary of a setting/world/topic. Don't expect the output to be final — treat it as a draft to edit.

## Best Practices

### Keyword choice
- Include variations: full names, first names, nicknames, titles.
- For common words, turn on `matchWholeWords` to avoid false positives.
- For proper nouns with unusual capitalization, consider `caseSensitive`.

### Entry length
- 1–3 short paragraphs is ideal. Entries over ~300 words tend to dominate context.
- If an entity has a lot of lore, split into multiple entries with overlapping keywords (general info + specific deep-dives).

### When NOT to use lorebooks
- **Small stable knowledge** — just put it in the character card.
- **Data that's always relevant** — put it in the card, skip the keyword machinery.
- **Fast-changing data** — lorebooks are for stable knowledge. Use webhook tools for live data.
- **Knowledge that's too big for any prompt** — at some point you need actual RAG. Marinara has `knowledge-retrieval` for semantic matching over lorebook entries; past that, you'd need a webhook to an external vector DB.

### When to use multiple lorebooks
- Separating world lore (global) from character-specific memories (character-scoped).
- Different settings/campaigns where only one should be active.
- Spellbooks (a Marinara-specific category) for combat ability lists.

## Migration from SillyTavern

Marinara imports SillyTavern lorebooks/world-info directly via Settings → Import. The schemas are mostly compatible; Marinara extends them with fields like `ephemeral`, `group`/`groupWeight`, `activationConditions`, `schedule`, and richer recursion controls.

## API Endpoints

- `GET /api/lorebooks` — list
- `GET /api/lorebooks/:id` — one lorebook (with entries)
- `POST /api/lorebooks` — create
- `PATCH /api/lorebooks/:id` — update
- `DELETE /api/lorebooks/:id` — delete
- `POST /api/lorebooks/:id/entries` — create entry
- `PATCH /api/lorebooks/:id/entries/:entryId` — update entry
- `DELETE /api/lorebooks/:id/entries/:entryId` — delete entry
- `GET /api/lorebooks/:id/export` — export JSON
- *(AI-assisted lorebook generation moved to `POST /api/professor-mari/workspace` in v2.0; the old `/api/lorebook-maker/generate` route was removed.)*

## UI Location

- **Lorebooks panel** (right sidebar) — create, edit, attach to characters/chats.
- **World Info Inspector** — live view of which entries are active in the current chat, with token usage and keyword reasons.
