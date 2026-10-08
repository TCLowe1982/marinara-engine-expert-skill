# Lorebooks

Lorebooks are **keyword-triggered knowledge injection** for characters and chats. Each lorebook contains entries; each entry has trigger keywords and content. When recent chat messages contain a keyword, the entry's content is injected into the prompt.

This is the right tool for **large, structured, but stable** reference knowledge that would waste tokens if always-on.

**Source of truth:** `packages/shared/src/schemas/lorebook.schema.ts`.

## Concepts

A **lorebook** is a container with:
- A name, description, category (`world` / `character` / `npc` / `spellbook` / `uncategorized`)
- A `tokenBudget` — maximum tokens of entries that can be injected per turn (default 2048)
- A `scanDepth` — how many recent messages to scan for keywords (default 2)
- `recursiveScanning` — if true, activated entries' content is itself scanned for more triggers (default false)
- `maxRecursionDepth` — cap on recursion (default 3, max 10)
- Scope: `isGlobal`, per-character (`characterId` / `characterIds[]`), per-persona (`personaId` / `personaIds[]`), or per-chat (`chatId` / `scope` object) — see the Scope section below
- Also: `entryLimit` (default 100, range 1–1000), `imagePath` (the lorebook's picture), `tags`, `hiddenFromLibrary` (the embedded-lorebook visibility toggle), and provenance (`generatedBy`, `sourceAgentId`)
- Semantic search: a whole-lorebook `excludeFromVectorization` that **defaults to `true`** — the Overview **Vectors** switch is off for new lorebooks (earlier guidance here called it "No Vector", which is the per-entry label) — plus `vectorQueryDepth`, `vectorScoreThreshold`, `vectorMaxResults`, `vectorIncludeAssistant` (see Semantic Matching below)

An **entry** is the actual knowledge chunk with:
- `name` — human-readable label
- `content` — what gets injected into the prompt
- `keys` — primary trigger words/regexes
- `secondaryKeys` — additional triggers
- Activation rules (constant, selective, probability, conditions, schedule, **Decision**)
- Timing (sticky, cooldown, delay, ephemeral)
- Grouping and priority (group, groupWeight, order)
- Position (before or after character description; depth within history)
- Matching options (whole-word, case-sensitive, regex)
- Reference images (`images`) sent with the entry to image-capable models
- Provenance on agent-written entries: `sourceMessageRefs` (`{ id, swipeIndex }[]`, server-managed) records the messages the entry was extracted from (v2.5.0) — `GET /api/lorebooks/:id/entries?sourceMessageId=…` filters by it, and deleting those messages cleans the lore up (see Best Practices → Agent-written lore)

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
| `probability` | number | `null` | **Percent chance, 0–100**, that a triggered entry actually fires (UI shows a percent; `null` or 100 = always; the scanner rolls `random()*100 < probability`). Earlier guidance here said 0–1 — that makes `0.5` a 0.5% chance. |
| `scanDepth` | number | `null` | Overrides the lorebook's scan depth for this entry. |
| `matchWholeWords` | bool | `false` | If true, `king` won't match `kingdom`. |
| `caseSensitive` | bool | `false` | If true, `King` ≠ `king`. |
| `useRegex` | bool | `false` | Treat `keys` as regex patterns instead of plain strings. |
| `position` | **0, 1, 2, or 7** | `0` | 0 = before character description, 1 = after, 2 = inject at message `depth`, **7 = Outlet** (placed wherever `{{outlet::name}}` appears). |
| `outletName` | string (max 200) | `""` | Outlet name matched by `{{outlet::name}}`. **Case-sensitive.** Only meaningful with `position: 7`. |
| `depth` | number | `4` | How many messages deep to inject (for `@depth` positioning). |
| `order` | number | `100` | Insertion order within same position/group. Lower = earlier. Agents with the `lorebook_update` result type can set it (v2.4.3, #5225). |
| `role` | `"system" | "user" | "assistant"` | `"system"` | What role to attribute the injection to. |
| `sticky` | number | `null` | Stay active for N messages after last trigger. |
| `cooldown` | number | `null` | Minimum messages between activations. |
| `delay` | number | `null` | Wait N messages before first activation in a chat. |
| `ephemeral` | number | `null` | Only active for N total activations per chat. Re-enabling an exhausted entry for the chat restarts the count (v2.4.6). |
| `group` | string | `""` | Group name. Entries in same group compete by weighted lottery. |
| `groupWeight` | number | `null` | Weight for intra-group competition. |
| `preventRecursion` | bool | **`true`** | Don't trigger further entries from this one's content. The drawer's **Recursion** toggle is its inverse and is **off** by default, so an entry chains only when you turn it on (earlier guidance here said the default was `false`). |
| `locked` | bool | `false` | Protect from agent edits (e.g., Lorebook Keeper — a downloadable Misc agent package as of v2.3, absent on fresh installs). |
| `tag` | string | `""` | Freeform category tag. |
| `relationships` | object | `{}` | Cross-entry references (for graph-style lore). |
| `dynamicState` | object | `{}` | Per-chat mutable state. |
| `activationConditions` | array | `[]` | Game-state gates: `{ field, operator, value }`. Operators are **`equals`, `not_equals`, `contains`, `not_contains`, `gt`, `lt`** (`activationConditionSchema`). |
| `schedule` | object | `null` | Time/date/location gating for game mode. |
| `description` | string | `""` | Short summary that only the **Knowledge Router** reads to decide relevance; never injected as content. Fill it on entries you expect the Router to route. |
| `excludeFromVectorization` | bool | `false` | "No Vector" — skip this entry in semantic embedding. |
| `excludeRecursion` | bool | `false` | This entry can't be activated *by* recursion. |
| `delayUntilRecursion` | bool | `false` | This entry only activates *during* recursion. |
| `folderId` | string | `null` | Folder this entry belongs to (a folder can be toggled to gate all its entries). |
| `characterFilterMode` / `characterFilterIds` | enum / string[] | `"any"` / `[]` | Restrict activation to specific characters. |
| `characterTagFilterMode` / `characterTagFilters` | enum / string[] | `"any"` / `[]` | Restrict by character tags. |
| `generationTriggerFilterMode` / `generationTriggerFilters` | enum / string[] | `"any"` / `[]` | Restrict by generation trigger (see Trigger types below). |
| `images` | `{ path, caption }[]` (max 4) | `[]` | Reference images sent when the entry activates (v2.5.0) — see Reference images. `path` must be a server-generated `/api/lorebooks/entry-images/…` file; caption ≤ 500 chars. |
| `decisionStatement` | string (max 500) | `""` | Statement about the recent chat for the Decision model to judge (v2.5.0) — see Decision activation. |
| `decisionMode` | `off` \| `require` \| `trigger` | `"off"` | The drawer's **Decision** field. An unknown mode imports as `off`. |
| `additionalMatchingSources` | string[] | `[]` | Also scan extra fields for keys — the seven valid values are `character_name`, `character_description`, `character_personality`, `character_scenario`, `character_tags`, `persona_description`, `persona_tags` (`lorebookMatchingSourceSchema`). |
| *filter mode* | `any` \| `include` \| `exclude` | `any` | `lorebookFilterModeSchema` — governs how the matching sources filter. `include` vs `exclude` changes activation semantics substantially. |

## Generation Trigger Types & Folders

Entries can be gated by **which generation triggered them** via `generationTriggerFilters` (+ `generationTriggerFilterMode`). The editor's built-in values (v2.5.0): `conversation`, `roleplay`, `game`, `chat` (Chat reply), `continue`, `autonomous`, `swipe`, `impersonate`, `prompt_preview`, `test_scan`, `game_setup`, `lorebook_assistant`. Note (1.6/2.0): guided `/guided` and guided manual replies now fire **Chat reply** triggers — so if an entry should fire on guided replies, set its trigger to `chat`, not Continue/Autonomous. **(v2.3.4)** `noodle` was added as a trigger type (#3842) — an entry can target **Noodle timeline refreshes only**, without leaking into chat/continue/autonomous generations. **(v2.5.0, #6660)** `slurp` targets **Slurp** posts the same way. Both are package triggers: the **Noodle** and **Slurp** options show only while their App package is installed (Slurp Legacy also shows Noodle — it sends the `noodle` trigger), and a saved choice stays on the entry if the package is removed.

Entries can also live in **folders** (`folderId`); toggling a folder gates every entry inside it. And `additionalMatchingSources` lets an entry's keys also match against character/persona fields (name, description, personality, scenario, tags), not just recent chat messages.

## Outlet position — placing an entry exactly

Set an entry's `position` to **7 (Outlet)** and give it an `outletName`. It is then injected wherever the matching **`{{outlet::name}}`** macro appears — in a preset, a card field, or anywhere else macros resolve — instead of at a fixed before/after/depth slot.

```text
Entry:  position: 7, outletName: "character_rules"
Prompt: ... {{outlet::character_rules}} ...
```

**Outlet names are case-sensitive** — `{{outlet::character_rules}}` does not match an outlet named `Character_Rules`. This is the answer to "how do I control *exactly* where this entry lands in the prompt," which the 0/1/2 positions can only approximate.

## Reusing entry text: `{{include::}}` (v2.5.0, #6912)

`{{include::Entry}}` inserts another entry's content wherever macros resolve — other entries, preset sections, card fields — so shared text (house rules, a faction blurb) has one source of truth instead of copies.

- Look up by **name** (case-insensitive) or **ID**. Inside an entry, a name resolves in that entry's own lorebook; elsewhere, in the chat's lorebooks (chat-pinned, character/persona-linked, global). An ID finds the entry in any lorebook.
- `{{include::Lorebook::Entry}}` reads from the named lorebook even when the chat doesn't use it or it's turned off.
- The included entry needn't activate and may be disabled, so "include-only" entries are a valid pattern. Includes nest; one that loops back to itself, or names something missing, resolves to empty. Names are literal — `{{include::{{char}}}}` is not filled in.
- Lorebook and entry editors have one-click **copy ID** controls (v2.4.3, #5085). The sibling macro `{{lorebooksize::ID}}` (v2.4.4, #5464) gives a lorebook's total entry count (enabled, disabled and foldered; unknown ID → `0`).

Full macro catalog: `references/character-cards.md`; engine `docs/prompts/macros.md` → Lorebook include macro.

## Reference images (v2.5.0, #6798)

An entry can carry up to **4** images — PNG, JPEG or WebP, 5 MB each, optional caption — added through the drawer's collapsed **Reference images** button (stored as `images: [{ path, caption }]`; files upload via `POST /api/lorebooks/:id/entries/:entryId/images`, and PATCH only reorders, recaptions or removes). When the entry activates, the images go to the chat model as user-role image messages, captioned "Reference N: …". Use it for faces, outfits, maps or item designs the model should *see* while that lore is in play.

- **Text-only models** get the entry text plus the captions and a notice; an image that can't be loaded degrades the same way. Captions are therefore worth writing.
- **Budget:** each image counts about 256 tokens plus its caption against the lorebook and chat token budgets. Under pressure images drop before the entry's text — they never displace text, recursively activated text included. Per request at most 16 images / 20 MB; the rest are skipped with a notice. An Outlet entry's images are sent only if its `{{outlet::…}}` is actually used.
- **Add wardrobe key** just appends `wardrobe` as an ordinary keyword; it has no special meaning.
- Portable lorebook and character exports carry at most **64 MiB** of reference images per request — split bigger exports or use a native profile ZIP.

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
Of the group members whose triggers fire, only one is chosen, weighted by `groupWeight`. The pick is re-rolled every generation by default; a winner with **Sticky** stays selected for its sticky duration (v2.4.6, #5913). **Stable lorebook picks** (v2.5.0; Settings → Advanced → Features, or `LOREBOOK_STABLE_GROUP_WINNERS=true`, which wins when set; off by default) keeps the same winner in a chat while the candidates stay the same — use it when prompt-prefix caching matters more than variety.

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
- **`personaId`** (single) or **`personaIds: []`** (multiple) — persona-scoped (new in v2.0). Auto-activates when that persona is in use. **(v2.4.2, #4887)** One that is explicitly added to a chat also works under a different persona; automatic owner matching and chat exclusions still apply.
- **`chatId`** plus the **`scope`** object `{ mode: "all" | "disabled" | "specific", chatIds: [] }` — chat targeting.

A `superRefine` enforces that a global lorebook (`isGlobal: true`) **cannot also** target specific characters or personas — pick global *or* scoped.

**Per-chat switches** (Chat Settings → **Lorebooks**): **Disable in this chat** / **Enable in this chat** pause an auto-activated lorebook for one chat without unlinking it. **(v2.4.6, #5954)** The entry switches there are per-chat too — they affect only that chat and keep ephemeral counters — but text and other entry edits made there still change the shared lorebook everywhere. An entry disabled in the shared lorebook can't be enabled per chat.

**(v2.4.0, #4333) Visibility toggle for reimported embedded character lorebooks.** When a character card is imported with an embedded lorebook, that lorebook can now be **hidden from general lorebook searches and selectors while staying linked, active, and editable**. It still works exactly as before in generation — this only removes it from browse/pick lists.

Why it matters for advice: users who bulk-import cards (SillyTavern migrations especially) used to end up with a lorebook list dominated by per-card embedded books, making their own hand-authored lorebooks hard to find. Recommend hiding embedded card lorebooks and leaving only deliberately-authored ones visible. "Hidden" is **not** "disabled" — if a user hides one expecting it to stop firing, correct that.

**When to use which:**
- World lore, shared universes → `isGlobal`.
- Character's personal memories, backstory depth → character-scoped.
- Persona-specific knowledge (about the user's role) → persona-scoped.
- Current scene state, one-session plot flags → chat-scoped.

**(v2.2)** Lorebooks can also activate inside **Noodle** timeline refreshes via an opt-in "Lorebook context" setting (off by default), reusing the group-chat multi-character lorebook system — see `references/architecture.md` → Noodle. **(v2.3)** The roster-scaling budget was replaced: world/lore context and chat carryover each get a fixed **8,192-token** budget, and linked-lorebook macros resolve before Noodle refresh prompts (#3687). **(v2.3.4)** Entries can also target Noodle refreshes *exclusively* via the `noodle` generation trigger filter — see Generation Trigger Types & Folders above.

## Token Budget Management

The lorebook's `tokenBudget` caps total injected content per turn; a chat-wide **Lorebook Token Budget** (Chat Settings → Lorebooks, default 8192, 0 = unlimited) caps all active lorebooks combined, and an entry is skipped if it would overflow either. If more entries match than fit, lower-`order` entries inject first (constant entries and group weighting also factor in); entries that don't fit are skipped — the World Info Inspector surfaces which were budget-skipped (a 1.6/2.0 visibility feature). **(v2.3.4)** Current semantic (vector) matches now get the **same budget priority** as current keyword matches — configured entry order, not activation method, decides which entries fit when over budget. (Before 2.3.4, semantically activated entries were effectively second-class in the budget queue.)

**What happens at the budget ceiling.** When activated entries exceed `tokenBudget` the engine trims rather than failing — see "How entries get trimmed" in `docs/lorebooks/token-budgets.md`. Order and group weighting decide who survives, so `order` is not merely cosmetic: it is the priority list for what gets dropped under pressure. Tuning the budget without also setting deliberate `order` values just means the engine picks the casualties for you.

**Game world generation is the exception (v2.4.6).** Entries the user explicitly selects for Game world generation — including a game-surface Experience's hand-picked entries — bypass the automatic lore token/count budgets and the probability roll (disabled entries and other filters still apply); only the model's context limit bounds them, and an oversized request stops with a context-limit error before it is sent. Decision fields read as no there.

**Practical sizing:**
- For casual characters: 500–1000 tokens budget.
- For rich worldbuilding: 2000–4000 tokens budget.
- Past ~4000 is usually a sign you should split into multiple lorebooks or use semantic memory (RAG over messages).
- **(v2.4.6)** Token estimates now account for Korean, Chinese and Japanese text, so CJK lore is counted more realistically against budgets, and prompt and context editors show estimated token counts instead of character counts — size budgets from those numbers.

**(v2.5.0) Big-lorebook storage.** Each reply stores its lorebook scan. `LOREBOOK_COMPACT_STORED_SCANS=true` (off by default) keeps full entry text only on a chat's newest reply — older messages keep entry ids, keys and scores — which makes chats with large lorebooks much smaller; `scripts/compact-lorebook-scans.mjs` applies it to older chats (stop the server; dry run unless `--apply`). See `docs/CONFIGURATION.md` → Lorebooks.

## Recursive Scanning

If `recursiveScanning` is true, the content of activated entries is itself scanned for triggers. This enables "chained" lore — entry A triggers, mentions B, B triggers, mentions C, etc. — up to `maxRecursionDepth`.

Recursion is opt-in at **two** levels: the lorebook's **Recursive** switch (off by default) *and* each chaining entry's **Recursion** toggle (`preventRecursion: false`; entries default to `true`). Recursively found entries still count against every budget and the entry limit. **(v2.4.6, #5942)** An entry the token budget skipped no longer feeds recursion, so dropped lore can't chain-trigger other entries; constants rejected by a location budget likewise stay out of later scans (#5943).

**When to use:**
- Complex fictional worlds where entries cross-reference each other.
- When you want mentioning one character to bring in their faction, their location, their history.

**When to avoid:**
- Small lorebooks (wastes compute, no benefit).
- Performance-sensitive chats (recursion has real cost).
- When entries are deliberately isolated (e.g., separate factions that shouldn't leak into each other).

**Mitigation:** turn the per-entry **Recursion** toggle on only for entries meant to chain, and leave it off on hub/overview entries (one that lists a faction's members would otherwise pull every member's full entry in at once — `docs/lorebooks/entries.md` → Structure lore as a tree). Earlier guidance here treated chaining as the per-entry default and `preventRecursion: true` as the opt-out; it is the other way round.

## Knowledge Retrieval, Router & Sources (Semantic Matching)

Related surfaces handle "the user mentioned a concept without the exact keyword" — the two Knowledge agents (v2.0, packaged in v2.3) and the lorebook's own semantic matching:

> **Changed in v2.3:** Knowledge Retrieval and Knowledge Router are no longer built-ins — they're **downloadable Writer Agent packages** (ids `knowledge-retrieval` / `knowledge-router`) in the official Marinara-Agents catalog. Fresh installs ship **no** optional agents, so either agent must be installed via Agents → Download Agents; upgrades from ≤2.2 migrate automatically. (The lorebook's own semantic matching below is built in and needs no package.)

- **Knowledge Retrieval** (`knowledge-retrieval` Writer Agent package, pre-generation) — reads every enabled entry of its chosen lorebooks **and uploaded knowledge-source files**, has its model extract the facts relevant to the recent messages (in chunked passes when the material exceeds its source budget), and injects that summary. Higher cost per turn than the Router. (Earlier guidance here called it embedding search over local MiniLM; the engine's retrieval step is an LLM extraction pass, not vector search.)
- **Knowledge Router** (`knowledge-router` Writer Agent package, pre-generation) — a lower-cost alternative that shows the model a catalog of entries (ID, name, a few keys, the entry **Description**), lets it **select relevant entries by ID**, and injects them verbatim. A vectorized lorebook improves its shortlist with semantic matches; otherwise it uses keyword matches only.
- **Knowledge Sources** (`/api/knowledge-sources`) — upload text files / PDFs that the Knowledge Retrieval agent can scan alongside lorebooks.

Both Knowledge agents are Roleplay-only per `docs/agents/knowledge-sources.md`.

**Embeddings (lorebook semantic matching):** turn on the lorebook's **Vectors** switch, pick an embedding source in its **Semantic Search (Embeddings)** panel — a connection with an **Embedding Model** set, or **Local Model (sidecar)** (`/api/sidecar/v1/embeddings`; hidden on Lite builds) — and vectorize. At chat time the query is embedded with the active connection's embedding model, or the built-in local model if it has none, so vectorize with the source you chat with. Embedding connections accept an OpenAI-compatible base URL or the provider's full `/embeddings` endpoint (v2.4.4, #5252); NanoGPT works as a source since its auth fix (v2.4.6, #5688). Per-entry `excludeFromVectorization` (**No Vector**) opts an entry out. Capability packages that embed text use the remote embedding source on their agent connection, keeping local MiniLM only as a fallback (v2.4.2, #4745).

**Semantic settings** (Overview, once **Vectors** is on): **Query Messages** (`vectorQueryDepth`, default 10, 0 = all), **Score Threshold** (`vectorScoreThreshold`, default 0.3, calibrated 0–1), **Vector Limit** (`vectorMaxResults`, default 10, max 100 — caps semantic matches before the token budgets). **(v2.5.0, #6670) Include character context** (`vectorIncludeAssistant`, off by default) also searches recent character replies as a separate query and keeps the stronger match; the user query is unchanged. **(v2.4.3, #5104)** Queries and documents get model-appropriate formatting, and recent user turns are prioritized.

**(v2.2) Vector search as keyword-miss fallback.** Semantic/vector similarity now also acts as a fallback for **ordinary keyed entries**: when an entry's keyword matching misses, vector similarity can still activate it, subject to the same score thresholds, max-results cap, filters, and probability gates. Previously this semantic path was unreachable for keyed entries. **(v2.3.4)** Entries activated this way also compete for the token budget on equal footing with keyword matches — see Token Budget Management.

**(v2.3) Baseline-calibrated similarity scores.** Similarity scores are calibrated against an unrelated-text baseline before threshold comparison, so embedding models whose raw cosine scores cluster high (~0.97) now work at normal thresholds — no more hand-tuned extreme thresholds (#3627).

**(v2.3) Macros resolve before matching.** Prompt macros like `{{user}}`/`{{char}}` are resolved *before* lorebook keyword routing and embedding scans (#3704, 2.3.2) — matching operates on macro-resolved text, so entry keys should target real character/persona names, never macro literals.

## Embedding a lorebook into a card vs. linking one

Two different relationships, and the visibility toggle below only makes sense once they're separated (`docs/lorebooks/linking-to-characters.md`):

- **Embedded** — the lorebook lives *inside* the character card (`character_book`). Travels with the card on export/import, which is what makes a shared card self-contained.
- **Linked / assigned** — an existing standalone lorebook is scoped to the character via `characterId` / `characterIds`. Shared across cards; does *not* travel with an exported card.

Recommend **embedded** when the lore belongs to exactly one character and the card will be shared; **linked** when several characters draw on one body of lore, or when the user wants to edit it independently.

Edits made through **Edit Embedded Lorebook** sync back into the card's embedded copy, and **(v2.4.2, #4927)** so do Professor Mari's entry adds, updates, deletes and restores on an embedded lorebook.

**(v2.4.0, #4333) Visibility toggle for reimported embedded lorebooks** (`hiddenFromLibrary`). A reimported embedded lorebook can be hidden from general lorebook searches and selectors while staying **linked, active, and editable**. Bulk card imports (SillyTavern migrations especially) otherwise bury hand-authored lorebooks under one embedded book per card. **Hidden is not disabled** — a hidden lorebook still fires normally. Correct that if a user hides one expecting it to stop. **(v2.4.2, #4775)** A lorebook that loses its last owning character or persona is deactivated *and* unhidden, so it reappears in the library instead of lingering invisibly.

## Re-vectorizing after an embedding-model change

Semantic search depends on entries being embedded with the *current* embedding model. `docs/lorebooks/semantic-search.md` covers picking an embedding source and **re-vectorizing after you change models**.

This is a real, quiet failure mode: switch the embedding model (or chat on a connection whose embedding model differs from the one that vectorized the lorebook) and the stored vectors no longer match the query's vector space. **(v2.4.3, #5104)** The engine now rejects incompatible stored vectors instead of mis-scoring them — those entries are simply skipped in semantic matching, with the reason in debug diagnostics but no error in the chat — and a "missing only" vectorize whose dimensions differ is refused ("Embedding dimensions changed…"). Fix it with **Re-vectorize all**. If a user reports "semantic matches stopped" or a thinner Knowledge Router shortlist after changing connections or local models, check this before debugging keys or budgets.

## Decision activation (v2.5.0, #6570)

The entry drawer's **Decision** field lets the user's **Decision model** judge a plain statement about the recent chat (`decisionStatement`, ≤ 500 chars; `{{user}}`/`{{char}}` resolve), e.g. `In the latest message, a dragon is physically present.` `decisionMode`:

- **Off** (default) — normal activation.
- **Require** — the entry must qualify the ordinary way (keyword, semantic match, **Constant**, or an attached map location, after filters, timing and the probability roll) **and** the statement must be true. Filters passing mentions; on a Constant entry it makes always-on lore situational (combat rules gated on `A fight is happening in the latest message`).
- **Trigger** — a yes is an extra route in: the entry activates even with none of its keywords present (paraphrases, situations). Ordinary routes still work.

What bites:

- **No answer reads as no.** With no Decision model set (the editor warns), or no answer, Require can't admit a new entry (an existing Sticky hold can keep one) and Trigger adds nothing. Use Require to filter optional lore — **never to gate anything the story or a safety rule depends on** — and give important Trigger entries real keys too.
- On a hosted Decision connection each statement is a paid request (batched where possible, answers reused within the turn), drawn from the per-turn **Decision statements per turn** allowance; statements past it read as no. Sticky and Cooldown skip re-asking.
- Chat turns only: Game setup, Experience generation and agents' own lorebook scans read decision entries as no. **Peek Prompt** never asks. The active-lorebook list labels Trigger activations **decision**.
- A `{{#if decision:"…"}}` block *inside* `content` is different — it trims text in an entry that already activated (the entry still spends budget and starts its timers).

Imports and exports keep the setting. How Decision models, statements, thresholds and cost work: `references/conditional-prompts.md`; engine `docs/lorebooks/entries.md` → Decision activation.

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

**(v2.4.2–v2.4.4)** Mari can set every user-editable entry setting, not just keys: `probability` (clamped 0–100), timing, recursion flags, group weight, per-entry scan depth, lock, folder, character/tag/trigger filters, and per-entry vectorization (when an embedding model is configured). Lorebook-authoring guidance and a user-gated fidelity review keep her entries from coming out skeletal (#4796). She can create nested entry folders and Lorebooks-panel library folders (#5391, #5421).

## Best Practices

The engine's long-form authoring guide — strategy per entry type, a worked multi-control example, pitfalls, macros and recursion in content — is `docs/lorebooks/entries.md` (expanded in v2.4.2, #4814). Cite it rather than re-deriving it.

### Keyword choice
- Include variations: full names, first names, nicknames, titles.
- For common words, turn on `matchWholeWords` to avoid false positives.
- For proper nouns with unusual capitalization, consider `caseSensitive`.
- **(v2.3)** Use real character/persona names as keys, not macro literals like `{{user}}` — macros are resolved before keyword routing and embedding scans (#3704), so matching only ever sees the resolved names.
- An invalid or potentially very slow regex key silently falls back to a plain-text match; **Check lorebook** (v2.5.0) flags these, along with common/short keys and keyless non-constant entries.

### Entry length
- 1–3 short paragraphs is ideal. Entries over ~300 words tend to dominate context.
- If an entity has a lot of lore, split into multiple entries with overlapping keywords (general info + specific deep-dives).
- **(v2.1)** This guidance is about *prompt economy*, not a storage limit. The old agent/tool write-path size cap on entry `content` was removed, so large entries written by `save_lorebook_entry` or the **Lorebook Keeper** agent persist intact with no pre-storage truncation. (They still count against a lorebook's `tokenBudget` at injection time — a big entry can be budget-skipped even though it's stored in full.)
- **(v2.3)** Lorebook Keeper is now a **downloadable Misc agent package** (`lorebook-keeper`) from the official catalog — absent on fresh installs, and its Game-setup controls appear only when installed.
- **(v2.3.4)** Entry `content` reaches the model **verbatim** — it is no longer HTML-escaped, so angle brackets and inline HTML/XML pass through exactly as written. You can deliberately use markup like `<scenario>` blocks in entries; conversely, watch for stray pseudo-XML the model might mistake for structure.

### Agent-written lore (Lorebook Keeper, `lorebook_update` agents)
- **Routing:** Keeper can write to exact writable lorebook names or configured aliases and auto-create missing category books (v2.4.4); an explicitly selected target wins through automatic runs, retries and approval (v2.4.6, #5907). It replaces an entry's body rather than stacking duplicates (v2.4.2, #4775). `locked: true` keeps it off an entry.
- **Provenance (v2.5.0):** Keeper entries remember their source messages (`sourceMessageRefs`). Deleting a message (single or bulk) removes entries whose whole source turn is gone and undoes in-place rewrites that turn made; hand-written entries are never touched. Regenerating drops lore written from the discarded swipe, and swiping back restores it. Leftovers can be found by filtering a lorebook's entries by source message.

### When NOT to use lorebooks
- **Small stable knowledge** — just put it in the character card.
- **Data that's always relevant** — put it in the card, skip the keyword machinery.
- **Fast-changing data** — lorebooks are for stable knowledge. Use webhook tools for live data.
- **Knowledge that's too big for any prompt** — at some point you need actual RAG. Marinara has lorebook semantic matching plus the `knowledge-router` / `knowledge-retrieval` packages for large lorebooks (downloadable Writer Agent packages as of v2.3 — install first); past that, you'd need a webhook to an external vector DB.

### When to use multiple lorebooks
- Separating world lore (global) from character-specific memories (character-scoped).
- Different settings/campaigns where only one should be active.
- Spellbooks (a Marinara-specific category) for combat ability lists.

## Migration from SillyTavern

Marinara imports SillyTavern lorebooks/world-info directly via Settings → Import. **Bulk paths exist and are usually what a migrating user wants** (`docs/lorebooks/import-export.md`): *Import many lorebooks at once*, *Export many lorebooks at once*, and **importing a whole SillyTavern folder** in one action. Since the skill recommends migrating over rebuilding, lead with the bulk path rather than the single-file one. **(v2.5.0, #6698)** Entries can also be imported from and exported to **Markdown** (one `## Name` heading per entry, optional `Keys: a, b` line, then the text) or **CSV** (`name`, `keys`, `content`, plus optional `folder`, `enabled`, `constant`, `probability` 0–100 columns) — into the current lorebook or a new one, with skip / overwrite / rename for duplicate names — handy for notes or spreadsheet-kept lore; a failed import changes nothing. The schemas are mostly compatible; Marinara extends them with fields like `ephemeral`, `group`/`groupWeight`, `activationConditions`, `schedule`, and richer recursion controls.

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

- **Lorebooks panel** (right sidebar) — create, edit, attach to characters/chats. **(v2.5.0, #7154)** Its **All** tab is one list in the selected sort order, without category sections (`docs/lorebooks/overview.md` still describes grouping).
- **Add to lorebook (v2.5.0, #6899)** — select a word or short phrase in a chat message (desktop or mobile), pick a lorebook, and it opens on a new entry named after the selection with the selection as its key.
- **World Info Inspector** — live view of which entries are active in the current chat, with token usage and keyword reasons. **(v2.3.4)** Roleplay's **Active Context** now shows the same lorebook diagnostics as Conversation and Game (#3840): activation sources, matched keys, semantic scores, current-location grouping, budget skips, and expandable entry content.

### Editor conveniences (v2.5.0 back to 2.1.1)

- **Batch editing** — **Select** entries (up to 5,000 per update), then a setting changed on one applies to all selected in one atomic update — matching toggles, position and **Outlet Name** (v2.4.4, #5410), depth, order, role, probability, timing, group, filters, recursion, vector exclusion, lock, tag, folder. Names, descriptions, keys and content stay per-entry. (Earlier guidance here said boolean toggles only.) Folders get a select/deselect-all-in-folder button (v2.4.4, #5413). Selected entries can also be copied or moved to another lorebook.
- **Bulk edit (v2.5.0, #6698)** — add or remove primary/secondary keys, set status, constant, probability, order/depth, or folder across the selection.
- **Check lorebook (v2.5.0)** — a lint pass: common or very short keys, keys shared between entries, duplicate or empty content, keyless non-constant entries, disabled entries, invalid/unsafe regex, over-long entries.
- **Scanner preview (v2.5.0)** — the **Keyword test** panel's **Run scanner** tests the lorebook against the current chat or pasted text the way a real reply would (timing ignored, chance rolls pass) and says why matched entries were held back (filters, group, disabled folder, secondary keys, 0% chance…).
- **Activation stats (v2.5.0)** — opt-in **Lorebook activation stats** (Settings → Advanced → Features, off by default) records which entries fire, so the editor can sort by use and show **Never fired** entries. Continue chunks don't count.
- **Copy / Paste links (v2.5.0, #6840)** — copy a lorebook's linked characters and personas onto another lorebook. Lorebook and entry IDs have one-click copy controls (v2.4.3).
- **Sort by entry status** — the editor can sort entries by their entry status (2.1.1).
- **Undo/redo & Tab indent (v2.3)** — native undo/redo works again in the Content and Description fields, and Tab / Shift+Tab indents/unindents every selected line without replacing the selection (2.3.2).
- **Lorebook Keeper cadence (v2.4.0, #4360)** — the Lorebook Keeper agent's Run Interval now counts **both user and assistant messages**, so an existing interval fires roughly twice as often as before. If auto-written entries suddenly multiply after upgrading, that's why; roughly double the interval to restore the old cadence. See `agents.md`.
- **Markdown preview (v2.4.0, #4306)** — lorebook text fields have Markdown preview toggles, like Character and Persona fields.
- **Lorebook Prompt Position (v2.3)** — the shared lorebook editor shell has a lorebook-level **Prompt Position** selector governing where the lorebook's content is placed in the prompt, distinct from the per-entry `position` field.
- **Character Lorebook tab** — **Edit Linked Lorebook** was renamed **Edit Embedded Lorebook** (2.1.1). A **Remove from card** action unlinks/clears an embedded lorebook — it works even for cards with no separate linked copy. (Row delete only unlinks the standalone; the embedded copy stays until you Remove from card.) **(v2.3)** File-native storage enforces primary/natural-key constraints, preventing ambiguous duplicate lorebook links. **(v2.3.4)** Embedded-lorebook data survives partial Character PATCHes (deep-merge, #3858), and unknown embedded-lorebook properties survive card validation (#3859) — imported cards with nonstandard fields no longer lose them.
