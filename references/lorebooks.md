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
| `content` | string | `""` | The text injected when triggered. Passed to the model verbatim as of v2.3.4 (no HTML-escaping) — see Entry length under Best Practices. |
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
| `position` | **0, 1, 2, or 7** | `0` | 0 = before character description, 1 = after, 2 = inject at message `depth`, **7 = Outlet** (placed wherever `{{outlet::name}}` appears). |
| `outletName` | string (max 200) | `""` | Outlet name matched by `{{outlet::name}}`. **Case-sensitive.** Only meaningful with `position: 7`. |
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
| `locked` | bool | `false` | Protect from agent edits (e.g., Lorebook Keeper — a downloadable Misc agent package as of v2.3, absent on fresh installs). |
| `tag` | string | `""` | Freeform category tag. |
| `relationships` | object | `{}` | Cross-entry references (for graph-style lore). |
| `dynamicState` | object | `{}` | Per-chat mutable state. |
| `activationConditions` | array | `[]` | Game-state gates: `{ field, operator, value }`. Operators are **`equals`, `not_equals`, `contains`, `not_contains`, `gt`, `lt`** (`activationConditionSchema`). |
| `schedule` | object | `null` | Time/date/location gating for game mode. |
| `description` | string | `""` | Optional entry description (UI only). |
| `excludeFromVectorization` | bool | `false` | "No Vector" — skip this entry in semantic embedding. |
| `excludeRecursion` | bool | `false` | This entry can't be activated *by* recursion. |
| `delayUntilRecursion` | bool | `false` | This entry only activates *during* recursion. |
| `folderId` | string | `null` | Folder this entry belongs to (a folder can be toggled to gate all its entries). |
| `characterFilterMode` / `characterFilterIds` | enum / string[] | `"any"` / `[]` | Restrict activation to specific characters. |
| `characterTagFilterMode` / `characterTagFilters` | enum / string[] | `"any"` / `[]` | Restrict by character tags. |
| `generationTriggerFilterMode` / `generationTriggerFilters` | enum / string[] | `"any"` / `[]` | Restrict by generation trigger (see Trigger types below). |
| `additionalMatchingSources` | string[] | `[]` | Also scan extra fields for keys — the seven valid values are `character_name`, `character_description`, `character_personality`, `character_scenario`, `character_tags`, `persona_description`, `persona_tags` (`lorebookMatchingSourceSchema`). |
| *filter mode* | `any` \| `include` \| `exclude` | `any` | `lorebookFilterModeSchema` — governs how the matching sources filter. `include` vs `exclude` changes activation semantics substantially. |

## Generation Trigger Types & Folders

Entries can be gated by **which generation triggered them** via `generationTriggerFilters` (+ `generationTriggerFilterMode`): `chat` (Chat reply), `continue`, `autonomous`, etc. Note (1.6/2.0): guided `/guided` and guided manual replies now fire **Chat reply** triggers — so if an entry should fire on guided replies, set its trigger to `chat`, not Continue/Autonomous. **(v2.3.4)** `noodle` was added as a trigger type (#3842) — an entry can target **Noodle timeline refreshes only**, without leaking into chat/continue/autonomous generations.

Entries can also live in **folders** (`folderId`); toggling a folder gates every entry inside it. And `additionalMatchingSources` lets an entry's keys also match against character/persona fields (name, description, personality, scenario, tags), not just recent chat messages.

## Outlet position — placing an entry exactly

Set an entry's `position` to **7 (Outlet)** and give it an `outletName`. It is then injected wherever the matching **`{{outlet::name}}`** macro appears — in a preset, a card field, or anywhere else macros resolve — instead of at a fixed before/after/depth slot.

```text
Entry:  position: 7, outletName: "character_rules"
Prompt: ... {{outlet::character_rules}} ...
```

**Outlet names are case-sensitive** — `{{outlet::character_rules}}` does not match an outlet named `Character_Rules`. This is the answer to "how do I control *exactly* where this entry lands in the prompt," which the 0/1/2 positions can only approximate.

## Organizing a large lorebook

Two distinct layers, worth using together once a lorebook passes a few dozen entries (`docs/lorebooks/entries.md`):

- **Categories** — the lorebook-level classification (`world` / `character` / `npc` / `spellbook` / `uncategorized`).
- **Entry folders** (`folderId`) — grouping *within* a lorebook. Toggling a folder gates every entry inside it, which makes folders a practical on/off switch for whole subsystems (a region, an arc, a faction) rather than only a tidiness feature.

This is the concrete answer to the skill's own warning against unmanaged 200-entry lorebooks.

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

**(v2.4.0, #4333) Visibility toggle for reimported embedded character lorebooks.** When a character card is imported with an embedded lorebook, that lorebook can now be **hidden from general lorebook searches and selectors while staying linked, active, and editable**. It still works exactly as before in generation — this only removes it from browse/pick lists.

Why it matters for advice: users who bulk-import cards (SillyTavern migrations especially) used to end up with a lorebook list dominated by per-card embedded books, making their own hand-authored lorebooks hard to find. Recommend hiding embedded card lorebooks and leaving only deliberately-authored ones visible. "Hidden" is **not** "disabled" — if a user hides one expecting it to stop firing, correct that.

**When to use which:**
- World lore, shared universes → `isGlobal`.
- Character's personal memories, backstory depth → character-scoped.
- Persona-specific knowledge (about the user's role) → persona-scoped.
- Current scene state, one-session plot flags → chat-scoped.

**(v2.2)** Lorebooks can also activate inside **Noodle** timeline refreshes via an opt-in "Lorebook context" setting (off by default), reusing the group-chat multi-character lorebook system — see `references/architecture.md` → Noodle. **(v2.3)** The roster-scaling budget was replaced: world/lore context and chat carryover each get a fixed **8,192-token** budget, and linked-lorebook macros resolve before Noodle refresh prompts (#3687). **(v2.3.4)** Entries can also target Noodle refreshes *exclusively* via the `noodle` generation trigger filter — see Generation Trigger Types & Folders above.

## Token Budget Management

The lorebook's `tokenBudget` caps total injected content per turn. If more entries match than fit, lower-`order` entries inject first (constant entries and group weighting also factor in); entries that don't fit are skipped — the World Info Inspector surfaces which were budget-skipped (a 1.6/2.0 visibility feature). **(v2.3.4)** Current semantic (vector) matches now get the **same budget priority** as current keyword matches — configured entry order, not activation method, decides which entries fit when over budget. (Before 2.3.4, semantically activated entries were effectively second-class in the budget queue.)

**What happens at the budget ceiling.** When activated entries exceed `tokenBudget` the engine trims rather than failing — see "How entries get trimmed" in `docs/lorebooks/token-budgets.md`. Order and group weighting decide who survives, so `order` is not merely cosmetic: it is the priority list for what gets dropped under pressure. Tuning the budget without also setting deliberate `order` values just means the engine picks the casualties for you.

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

> **Changed in v2.3:** Knowledge Retrieval and Knowledge Router are no longer built-ins — they're **downloadable Writer Agent packages** (ids `knowledge-retrieval` / `knowledge-router`) in the official Marinara-Agents catalog. Fresh installs ship **no** optional agents, so semantic lorebook retrieval requires installing the package via Agents → Download Agents; upgrades from ≤2.2 migrate automatically.

- **Knowledge Retrieval** (`knowledge-retrieval` Writer Agent package, pre-generation) — embedding-based semantic search (local `all-MiniLM-L6-v2` embeddings) over selected lorebooks **and uploaded knowledge-source files**; injects the relevant matches. Complementary to keyword matching.
- **Knowledge Router** (`knowledge-router` Writer Agent package, pre-generation) — a lower-cost alternative that **selects relevant lorebook entries by ID** and injects them directly, rather than doing full embedding search.
- **Knowledge Sources** (`/api/knowledge-sources`) — upload text files / PDFs that the Knowledge Retrieval agent can scan alongside lorebooks.

**Embeddings:** entries are embedded via a configured **embedding connection** (e.g. the Local Model sidecar's `/api/sidecar/v1/embeddings`); per-entry `excludeFromVectorization` (and the lorebook-level "No Vector") opt entries out. Embedding isn't purely automatic — it depends on having an embedding source configured.

**(v2.2) Vector search as keyword-miss fallback.** Semantic/vector similarity now also acts as a fallback for **ordinary keyed entries**: when an entry's keyword matching misses, vector similarity can still activate it, subject to the same score thresholds, max-results cap, filters, and probability gates. Previously this semantic path was unreachable for keyed entries. **(v2.3.4)** Entries activated this way also compete for the token budget on equal footing with keyword matches — see Token Budget Management.

**(v2.3) Baseline-calibrated similarity scores.** Similarity scores are calibrated against an unrelated-text baseline before threshold comparison, so embedding models whose raw cosine scores cluster high (~0.97) now work at normal thresholds — no more hand-tuned extreme thresholds (#3627).

**(v2.3) Macros resolve before matching.** Prompt macros like `{{user}}`/`{{char}}` are resolved *before* lorebook keyword routing and embedding scans (#3704, 2.3.2) — matching operates on macro-resolved text, so entry keys should target real character/persona names, never macro literals.

## Embedding a lorebook into a card vs. linking one

Two different relationships, and the visibility toggle below only makes sense once they're separated (`docs/lorebooks/linking-to-characters.md`):

- **Embedded** — the lorebook lives *inside* the character card (`character_book`). Travels with the card on export/import, which is what makes a shared card self-contained.
- **Linked / assigned** — an existing standalone lorebook is scoped to the character via `characterId` / `characterIds`. Shared across cards; does *not* travel with an exported card.

Recommend **embedded** when the lore belongs to exactly one character and the card will be shared; **linked** when several characters draw on one body of lore, or when the user wants to edit it independently.

**(v2.4.0, #4333) Visibility toggle for reimported embedded lorebooks.** A reimported embedded lorebook can be hidden from general lorebook searches and selectors while staying **linked, active, and editable**. Bulk card imports (SillyTavern migrations especially) otherwise bury hand-authored lorebooks under one embedded book per card. **Hidden is not disabled** — a hidden lorebook still fires normally. Correct that if a user hides one expecting it to stop.

## Re-vectorizing after an embedding-model change

Semantic search depends on entries being embedded with the *current* embedding model. `docs/lorebooks/semantic-search.md` covers picking an embedding source and **re-vectorizing after you change models**.

This is a real, quiet failure mode: switch the embedding model and semantic retrieval silently degrades — entries stay embedded under the old model's vector space — until the lorebook is re-vectorized. If a user reports "Knowledge Retrieval stopped finding things" after changing connections or local models, check this before debugging keys or budgets.

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

**(v2.3)** Mari's lorebook creation saves generated entries **atomically** — all-or-nothing — and blank lorebook-generation turns were fixed (#3674).

## Best Practices

### Keyword choice
- Include variations: full names, first names, nicknames, titles.
- For common words, turn on `matchWholeWords` to avoid false positives.
- For proper nouns with unusual capitalization, consider `caseSensitive`.
- **(v2.3)** Use real character/persona names as keys, not macro literals like `{{user}}` — macros are resolved before keyword routing and embedding scans (#3704), so matching only ever sees the resolved names.

### Entry length
- 1–3 short paragraphs is ideal. Entries over ~300 words tend to dominate context.
- If an entity has a lot of lore, split into multiple entries with overlapping keywords (general info + specific deep-dives).
- **(v2.1)** This guidance is about *prompt economy*, not a storage limit. The old agent/tool write-path size cap on entry `content` was removed, so large entries written by `save_lorebook_entry` or the **Lorebook Keeper** agent persist intact with no pre-storage truncation. (They still count against a lorebook's `tokenBudget` at injection time — a big entry can be budget-skipped even though it's stored in full.)
- **(v2.3)** Lorebook Keeper is now a **downloadable Misc agent package** (`lorebook-keeper`) from the official catalog — absent on fresh installs, and its Game-setup controls appear only when installed.
- **(v2.3.4)** Entry `content` reaches the model **verbatim** — it is no longer HTML-escaped, so angle brackets and inline HTML/XML pass through exactly as written. You can deliberately use markup like `<scenario>` blocks in entries; conversely, watch for stray pseudo-XML the model might mistake for structure.

### When NOT to use lorebooks
- **Small stable knowledge** — just put it in the character card.
- **Data that's always relevant** — put it in the card, skip the keyword machinery.
- **Fast-changing data** — lorebooks are for stable knowledge. Use webhook tools for live data.
- **Knowledge that's too big for any prompt** — at some point you need actual RAG. Marinara has `knowledge-retrieval` for semantic matching over lorebook entries (a downloadable Writer Agent package as of v2.3 — install it first); past that, you'd need a webhook to an external vector DB.

### When to use multiple lorebooks
- Separating world lore (global) from character-specific memories (character-scoped).
- Different settings/campaigns where only one should be active.
- Spellbooks (a Marinara-specific category) for combat ability lists.

## Migration from SillyTavern

Marinara imports SillyTavern lorebooks/world-info directly via Settings → Import. **Bulk paths exist and are usually what a migrating user wants** (`docs/lorebooks/import-export.md`): *Import many lorebooks at once*, *Export many lorebooks at once*, and **importing a whole SillyTavern folder** in one action. Since the skill recommends migrating over rebuilding, lead with the bulk path rather than the single-file one. The schemas are mostly compatible; Marinara extends them with fields like `ephemeral`, `group`/`groupWeight`, `activationConditions`, `schedule`, and richer recursion controls.

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
- **World Info Inspector** — live view of which entries are active in the current chat, with token usage and keyword reasons. **(v2.3.4)** Roleplay's **Active Context** now shows the same lorebook diagnostics as Conversation and Game (#3840): activation sources, matched keys, semantic scores, current-location grouping, budget skips, and expandable entry content.

### Editor conveniences (v2.3 / v2.2 / 2.1.1)

- **Batch editing** — select many entries (up to thousands) and apply one boolean setting — recursion, case sensitivity, whole-word matching, vector exclusion, or `enabled` — to all of them in a single atomic update. Good for flipping a lorebook-wide toggle without touching entries one by one.
- **Sort by entry status** — the editor can sort entries by their entry status (2.1.1).
- **Undo/redo & Tab indent (v2.3)** — native undo/redo works again in the Content and Description fields, and Tab / Shift+Tab indents/unindents every selected line without replacing the selection (2.3.2).
- **Lorebook Keeper cadence (v2.4.0, #4360)** — the Lorebook Keeper agent's Run Interval now counts **both user and assistant messages**, so an existing interval fires roughly twice as often as before. If auto-written entries suddenly multiply after upgrading, that's why; roughly double the interval to restore the old cadence. See `agents.md`.
- **Markdown preview (v2.4.0, #4306)** — lorebook text fields have Markdown preview toggles, like Character and Persona fields.
- **Lorebook Prompt Position (v2.3)** — the shared lorebook editor shell has a lorebook-level **Prompt Position** selector governing where the lorebook's content is placed in the prompt, distinct from the per-entry `position` field.
- **Character Lorebook tab** — **Edit Linked Lorebook** was renamed **Edit Embedded Lorebook** (2.1.1). A **Remove from card** action unlinks/clears an embedded lorebook — it works even for cards with no separate linked copy. (Row delete only unlinks the standalone; the embedded copy stays until you Remove from card.) **(v2.3)** File-native storage enforces primary/natural-key constraints, preventing ambiguous duplicate lorebook links. **(v2.3.4)** Embedded-lorebook data survives partial Character PATCHes (deep-merge, #3858), and unknown embedded-lorebook properties survive card validation (#3859) — imported cards with nonstandard fields no longer lose them.
