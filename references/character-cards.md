# Character Cards

Characters in Marinara Engine follow the **V2 Character Card spec** (`chara_card_v2`), with Marinara-specific extensions. A character is a JSON object stored via Marinara's file-native storage (under `DATA_DIR/storage`; SQLite is legacy) and rendered through the Characters Panel UI.

**Source of truth:** `packages/shared/src/schemas/character.schema.ts` and `packages/server/src/db/seed-mari.ts` (the built-in Professor Mari assistant is the canonical example of a complex card).

## The V2 Card Schema

```typescript
{
  name: string,                     // required (whitespace-trimmed)
  summary: string,                  // (v2.4.5) library/preview blurb, ≤500 chars — NOT sent to the model
  description: string,              // the main character description
  personality: string,              // traits, speech style, quirks
  scenario: string,                 // the setting / framing
  first_mes: string,                // the character's opening message
  mes_example: string,              // example dialogue (teaches the model voice)
  creator_notes: string,            // not sent to model; for other users
  system_prompt: string,            // character-specific rules, added via the card block (does NOT replace the preset's system prompt)
  post_history_instructions: string, // instructions inserted after message history
  tags: string[],
  creator: string,
  character_version: string,        // default "1.0"; auto-bumped on content edits (see Version history)
  alternate_greetings: string[],    // shuffleable alternate first messages
  extensions: {                     // Marinara-specific
    talkativeness: number,          // 0-1; affects autonomous messaging rate
    fav: boolean,
    world: string,                  // linked lorebook name
    depth_prompt: {
      prompt: string,
      depth: number,                // how many messages from the end to inject at
      role: "system" | "user" | "assistant",
    },
    backstory: string,
    appearance: string,
    imageAppearanceEnabled: boolean, // (v2.5.0) Image Appearance Override switch (optional, off by default)
    imageAppearance: string,         // image-prompt-only appearance; used instead of `appearance` when enabled + non-empty
    versioningEnabled: boolean,      // (v2.4.3) "Automatic versioning" switch, default true
    rulesetSheets: { [rulesetId: string]: unknown }, // (v2.5.0) Game Mode starting builds, 64 KB each — see below
    // Typed Marinara display fields (first-class in the schema, not just passthrough):
    nameColor: string,              // CSS color or gradient for the character's name
    dialogueColor: string,          // quoted dialogue is bold + colored with this
    boxColor: string,               // chat bubble / dialogue box background
    conversationStatus: "online" | "idle" | "dnd" | "offline",
    rpgStats: {                     // RPG stats toggle + custom attributes
      enabled: boolean,
      attributes: { name: string, value: number }[],   // e.g. STR / DEX / CHA
      hp: { value: number, max: number },
    },
    isBuiltInAssistant: boolean,    // Mari only
    // Conversation-mode-only fields (optional; absent on non-convo cards) — see below:
    convoDisplayName: string,       // sender label distinct from `name`
    convoDisplayNameInCard: boolean, // toggle: declare the display name in the prompt
    aboutMe: string,                // Discord-style "about me" blurb
    convoBehavior: {                // Conversation-only behavior directive
      instruction: string,
      insertionStrategy: "constant_before" | "constant_after" | "post_history_replace"
        | "post_history_before" | "post_history_after" | "macro",  // default constant_after
    },
    // aboutMeSources — legacy (v2.3) AI-write source picker; gone from schema and editors, may linger on old cards
    // (the extensions object still allows arbitrary passthrough keys too)
  },
  // phoneticName lives as a top-level character/persona column (not in extensions):
  phoneticName: string,             // TTS pronunciation spelling; edited in the Voice tab (v2.5.0)
  character_book: CharacterBook | null,  // embedded lorebook (optional)
}
```

## Where Each Field Shows Up in the Prompt

Not all fields get sent to the model on every turn. Here's roughly what happens:

| Field | Sent to model? | When? |
|---|---|---|
| `name` | yes | Always, as the character identifier. |
| `description` | yes | Core system prompt on every turn. Usually the biggest block. |
| `personality` | yes | Its own section, immediately after `description`. |
| `scenario` | yes | As a separate section; sets the framing. |
| `first_mes` | yes | Only as the first assistant turn. Not re-sent afterward. |
| `mes_example` | yes | The last card section in the prompt (after `scenario`); teaches the model voice. **(v2.4.3)** If the preset has no **Dialogue Examples** marker it's appended to **Character Info** after Scenario; a preset with a *disabled* Dialogue Examples marker omits it on purpose. |
| `system_prompt` | yes | Added with the card's other fields through the preset's character block (Conversation character context / Game card in those modes). It does **not** replace the preset's own system prompt (`DEFAULT_CHARACTER_MARKER_FIELDS`, `marker-expander.ts`). |
| `post_history_instructions` | yes | Inserted at the end, after recent messages. |
| `tags`, `creator`, `creator_notes`, `summary` | no | Metadata / library previews, not sent to model — except when the card is pulled in by a Character-ID macro (see below). |
| `extensions.appearance` | yes | An ordered card section (between `backstory` and `scenario`); also used in image generation unless the Image Appearance Override is on. Macros in it resolve before image agents read it (v2.4.4, #5432), so `{{user}}` there is safe. |
| `extensions.imageAppearance` | image prompts only | **(v2.5.0, #7053)** Used *instead of* `appearance` when `imageAppearanceEnabled` is on and the text is non-empty — see Image Appearance Override below. Never sent to the chat model; the narrator always gets the full `appearance`. |
| `extensions.backstory` | yes | An ordered card section (between `personality` and `appearance`). |
| `extensions.depth_prompt` | yes | Inserted at N messages deep. |
| `extensions.talkativeness` | no (structurally) | Used by autonomous messaging logic. |
| `character_book` (embedded lorebook) | yes | Entries trigger normally based on keywords. |

**Practical implication:** anything you want the model to *always* know goes in `description` / `personality` / `system_prompt`. Anything it only needs when a keyword is mentioned goes in the lorebook (either character-scoped or a separate file). Behavior that should apply only when something is *happening in the scene* ("when flustered…") can sit in the card behind a Decision statement — see Conditional blocks below.

**(v2.2)** The advanced prompt fields — `system_prompt`, `post_history_instructions`, and `extensions.depth_prompt` — now apply across **Conversation and Game modes too**, not just Roleplay. A card built for Conversation can carry the same system/post-history/depth steering it would in Roleplay.

**(v2.3.4)** Card sections keep a **guaranteed order** in the prompt — Description → Personality → Backstory → Appearance → Scenario → then Example Dialogue when present — and that order holds across preset markers, fallbacks, agent lore, and Game/scene card contexts (#3817).

**(v2.3.4)** Field content reaches the model **verbatim**: angle brackets in card fields, persona, lorebook entries, memories, and scene text are no longer HTML-escaped, so `<thinking>`, `<scenario>`, or an inline `<div>` pass through exactly as written. Deliberate XML/HTML markup is now a supported authoring tool (structural section wrappers and agent value/attribute escapers are unchanged) — see Common Mistakes for the flip side.

### Image Appearance Override (v2.5.0, #7053)

Characters **and personas** have an **Image Appearance Override** switch under **Appearance** (Card tab), off by default; turning it on reveals a second box. While it's on and filled, every image prompt that would attach the card's appearance (**Attach Card Appearance**) uses that text instead: chat illustrations, Conversation selfies, Game mode, custom `image_prompt` agents and the built-in Illustrator, retries, characters used as the user identity, and characters left out of native image captions. It also seeds the **Generate avatar** prompt. The narrator/chat model always keeps the full **Appearance**. The editor's hint: write it as **short image tags** and leave out clothing that changes scene to scene. Characters store it in `extensions.imageAppearanceEnabled` / `extensions.imageAppearance`; personas carry the same pair as persona fields.

## Character vs. Persona: A Critical Distinction

**Character** = an AI entity the user chats with.
**Persona** = the user's own identity in the chat.

They have similar fields but serve opposite roles. If the user asks "how do I give my character a detailed backstory," you're building a character. If they ask "how do I tell the AI about *me*," you're building a persona. The engine substitutes `{{user}}` in prompts with the chat's persona name and injects the persona's data into the prompt too. **(v2.4.6, #6206–#6208)** There is **no global active persona** any more: each chat uses the persona selected for *that chat* (Chat Settings → **Persona**, the new-chat wizard, or the Quick Persona Switcher), and a chat with **None** stays anonymous end-to-end — the model gets the generic name `User` and no persona details — in **every** mode, Conversation included. *(Changed in v2.4.6 — earlier guidance said Conversation fell back to the globally active Persona; that setting was removed.)* **(v2.3)** `{{user}}` / `{{char}}` and other macros in `first_mes`, alternate greetings, and `/guided` instructions now resolve at the **final provider boundary** — including lorebook routing and embedding scans — so raw placeholders can no longer reach the model (#3704). **(v2.3.4)** Name Prefix History is now **persona-accurate per turn**: historical user turns stay labeled with the Persona that actually sent them, so switching Personas no longer rewrites earlier prefixes. To deliberately relabel them, Chat Settings has **Apply persona to earlier messages…** (v2.4.6, #6043).

**They're not a one-way street.** `docs/characters/personas.md` documents an **Add persona as character** action that converts a persona into a character card, and the Character Editor header has the reverse, **Import character as persona**. So "I built this as a persona but now I want to chat *with* them" doesn't require rebuilding by hand — which the parallel-object-types framing above would otherwise imply. Personas can also be duplicated and deleted from the same panel. **(v2.4.6)** You don't even need to convert: with **Settings → Advanced → Message Tools → Show characters in Persona pickers** on, persona pickers (new-chat setup, Chat Settings, Quick Persona Switcher) gain a **Play as a character** folder, so any saved character can be the user's identity in Conversation or Roleplay. **(v2.5.0, #7151/#7093)** Pickers show each card's title/comment to tell same-name cards (e.g. AU copies) apart.

**(v2.3)** Both a character's metadata and a persona's lead their primary identity block with a clearly labeled **avatar upload/replace field** (same upload/crop flow as the editor portrait), above **Name** and the **Title / comment** field (synced with the editor-header field) — a short human label for the card, distinct from the model-facing `name`. **(v2.3)** Personas also gained an **Open Full Library** mirroring the Character Library — card grid, search, sorting, preview pane, paging, scroll restoration, and the editor return flow; both libraries use the Settings chroma text color. **(v2.3.4)** Editor polish: tracker-card color settings preview immediately and persist, and cropped avatars stay contained in their editor upload targets and no longer hijack page clicks (#3741/#3939).

## Conversation-mode Profile

These fields live on the character/persona `extensions` schema (`character.schema.ts:47-69`), are edited on the editor's **Convo** tab, and are **Conversation-mode only** — they're never sent in Roleplay / VN / Game mode. Characters and personas carry the same profile columns, and Professor Mari's `character.create` / `persona.create` (and `mari personas create`) can populate them.

- **`convoDisplayName`** — a live sender label shown above the character's messages, distinct from the card `name`. The **`convoDisplayNameInCard`** toggle additionally declares the display name inside the prompt so the model maps it back to the card — mainly useful in **group Conversations**, where generation instructions, speaker parsing, labels, typing events, and base-name matching all honor it.
- **`aboutMe`** — a Discord-style "about me" blurb surfaced in the participant popout, and added to the Conversation prompt automatically as a participant profile. **(v2.3)** The old gear-icon source picker and per-editor model connection were removed (`aboutMeSources` is legacy). **(v2.4.5)** The **Character Editor's Convo tab** has two drafting buttons — **Generate About Me from this card** and **Generate Conversation behavior from this card** — which write from the card's own fields (available once the card is saved; the Persona editor has no such button). *(Changed in v2.4.5 — earlier guidance said drafting went only through Professor Mari.)* Asking **Professor Mari** still works too: she reads the saved profile, writes the bio in their voice, and saves it to the real `aboutMe` field through her review card. Note `docs/conversation/profiles.md` still says there is no generation button — the shipped editor has one.
- **Per-chat about-me override** — separate from the card default. In Conversation mode, click a participant's avatar to set/edit/clear a **chat-specific** about-me that supersedes the card default in that one conversation (Discord per-server-profile style; pairs with the `update_about_me` tool's `chat` scope).
- **`convoBehavior`** — a Conversation-only behavior directive (`instruction` text plus an `insertionStrategy`). Strategies: `constant_before`, `constant_after` (default), `post_history_replace`, `post_history_before`, `post_history_after`, and `macro` (place it yourself with `{{convo_behavior}}`).
- **Weekly schedule** (Convo tab, characters) — the character's daily routine. It drives presence, reply delays, and autonomous messages, and **(v2.5.0, #6481/#6477)** it is **owned by the character** and shared by every Conversation chat they're in; individual chats can switch schedules off in Chat Settings, enabling schedules no longer starts a generation, and weekly renewal is an explicit per-character opt-in.

### Voice (v2.5.0, #6997/#7008)

The Character Editor has a **Voice** tab: pick the Text to Speech voice for this character and **Preview** it. It is the same setting as this character's row in **Connections → Text to Speech** (it saves immediately — a Text to Speech setting, not card data). Same-name cards, such as an AU copy, can each keep their own voice; until a copy gets one, its Voice field names the voice it inherits. If every character shares one voice, the tab offers **Use a voice per character**. **Phonetic name** moved here too.

- **`phoneticName`** (top-level column, `phonetic_name`; part of the card, so it needs **Save**) — a pronunciation spelling for TTS, including Conversation Calls. Exposed via `{{charNamePhonetic}}` / `{{userNamePhonetic}}`, which fall back to `{{char}}` / `{{user}}` when empty.

### Conversation macros

Conversation mode registers a `Conversation` macro category (`SUPPORTED_MACROS` in `packages/shared/src/utils/macro-engine.ts`). Profile macros pull the fields above: `{{convo_display}}`, `{{char_about}}`, `{{persona_about}}`, `{{convo_behavior}}`. **Relocation macros** move an auto-inserted block to where you place it (and skip its automatic insertion): `{{context}}` / `{{status}}`, `{{commands}}`, `{{reactRules}}`, `{{replyRules}}`, `{{memories}}`, `{{lorebook}}`.

**(v2.3.4)** Two macro additions usable in card text generally (not Conversation-only): **`{{group}}`** expands to every other active chat character — it works during targeted Roleplay group generation too, and the full roster is kept available in manual group generation so it never resolves empty — and **conditional prompt macros** gained `||` (OR), `&&` (AND), parentheses, and an equality-list shorthand — see Conditional blocks and Decision statements below.

### Character-ID macros (v2.4.0, #4336; narrowed in v2.5.0, #6956)

To reference another character, copy that card's ID (Metadata → **Character ID** → **Copy**) and put it directly inside double braces:

```text
{{V1StGXR8_Z5jdHi6B-myT}}
```

The macro always becomes **the card's name** — in every mode, and (v2.5.0, #6924) even when that character is already in the chat (their card isn't added twice). Whether the **card itself** reaches the model depends on the chat. *(Changed in v2.5.0 — earlier guidance said the card context is always added and example dialogue is excluded.)*

- **Roleplay chat with a prompt preset** — the referenced card's context is added to the system prompt: Description, Personality, Backstory, Appearance, Scenario **and Example Dialogue**, plus its other non-empty text fields (system prompt, post-history, depth prompt, creator notes, tags, RPG attributes — `buildReferencedCharacterFields`, `packages/server/src/services/prompt/macro-context.ts`; the docs list only the six card sections). Only the **greetings** are left out. The preset's **ID Macro Cards** marker places this block; without the marker it goes to the default position. IDs inside activated lorebook entries resolve here too, and **lorebooks attached to the referenced card activate normally** under their usual keyword, constant, filter, probability, and token-budget rules.
- **Conversation, Game, and preset-less Roleplay** — **name only**; nothing from the card is added.

**(v2.5.0, #7045)** In Roleplay groups using **Merged (Narrator)**, characters referenced by ID (including through lorebooks) join the reply's cycling avatars without being added to the group; each swipe keeps the references used for that reply.

**Persona-ID macros (v2.4.3, #5171).** `{{persona-<21-character ID>}}` (e.g. `{{persona-P1StGXR8_Z5jdHi6B-myT}}`) does the same for a persona that isn't the chat's own: its name in place, and its Description, Personality, Backstory, Appearance, Scenario plus eligible attached-lorebook context in the same ID Macro Cards block.

**Why this matters for ideation.** This is the clean answer to "my character should know about their sister / rival / mentor who exists as their own card, but I don't want them in the chat." Previously the options were duplicating the description into the card (drift, token cost) or a lorebook entry restating it (a second source of truth). In a Roleplay-with-preset chat, one card is the single source and other cards reference it by ID. Outside that path, or when you only need a shared paragraph rather than a whole card, keep the text in one lorebook entry and reuse it with **`{{include::Entry}}`** (below).

**Caveats to state when recommending it:**
- It pulls the **whole** character context every time the macro resolves, so it is not free — don't scatter it across a dozen references in one card. At most **8** referenced characters and 8 personas are added per prompt (`MAX_REFERENCED_CHARACTERS` / `MAX_REFERENCED_PERSONAS`), each field clipped at 8,000 characters.
- The referenced card's **creator notes and tags reach the model** in this path, so keep private notes out of cards meant to be referenced.
- It's an ID, not a name, so the card text becomes opaque to a human reader. Put a `{{// note}}` comment beside it (removed before sending) saying who the ID belongs to.
- If the referenced card is deleted, the reference breaks. For a stable shared canon that several cards depend on, a **lorebook** (plus `{{include::}}`) is still the more robust structure — use Character-ID macros for genuine character-to-character references.

Docs: `docs/prompts/macros.md`.

### The macro catalog — 77 entries, by category

`SUPPORTED_MACROS` in `packages/shared/src/utils/macro-engine.ts` is the list the in-field **Macro reference** button and `/macros` (or `/macro`) show: **77 entries at v2.5.0** (65 at v2.4.0), in the categories Identity, Character, Conversation, Context, Lorebooks, Game, Time, Random, Variables, Formatting — 8 of the Formatting entries are `{{#if}}` conditional forms. The highlights are below; `docs/prompts/macros.md` is the authoritative full list.

**Variables — persistent in-engine state.** Read this before recommending a backend for state.

| Macro | Effect |
|---|---|
| `{{setvar::name::value}}` | Stores a value, renders nothing |
| `{{getvar::name}}` | Reads a stored value (empty if never set) |
| `{{addvar::name::value}}` | Adds when both values are numeric, otherwise **appends** the text (SillyTavern semantics, v2.4.3, #5158) |
| `{{addnumvar::name::value}}` | **(v2.4.3, #5024)** Marinara extension: always a numeric add; missing/invalid numbers count as 0, an overflowing add is ignored |
| `{{incvar::name}}` / `{{decvar::name}}` | ±1 and insert the new value |
| `{{NAME}}` (any non-built-in name) | A preset variable of that name, else a chat variable; unknown names stay as typed |

**This materially changes the persistence advice.** Per-chat counters, flags, and small structured state — affection scores, day counters, whether an event has fired — live here, not in a webhook plus your own backend. Reserve the backend recommendation for data that must outlive or span chats, or that is genuinely large or externally owned. How they behave:

- **Per chat, not global (v2.4.3, #5158).** Values are saved in the current chat and survive later turns and restarts; another chat has its own values. Within one prompt build they resolve left to right, so a value set in an earlier lorebook entry can be read later in the same prompt.
- **Versioned with the reply (v2.5.0, #6923).** A change belongs to the reply that made it, like tracker values: a new swipe starts from the values before that reply, switching swipes restores that swipe's values, and deleting the reply undoes its changes — so a lorebook countdown no longer ticks again on every swipe.
- **Gotcha:** a `{{setvar}}` inside a `{{random::…}}` option runs for *every* option before the pick.

**Chat Variables (v2.5.0).** **Chat Settings → Chat Variables** lets the user add name/value pairs directly and use them as a bare `{{name}}` anywhere macros work, including their own messages: set `char1` = `Mary`, type `{{char1}} walks in.`, and the AI reads "Mary walks in." The message keeps showing the tag, so changing a value later changes every earlier turn that used it. It is the **same per-chat storage as `{{setvar}}`** — the section lists prompt-set variables too, and a prompt or lorebook `setvar` of the same name overwrites a typed value (typed values survive swipe rollback). Names: letters, digits, underscores, starting with a letter or underscore; exactly-21-character names are reserved for character IDs; built-in macro names are refused; a preset variable wins a name clash. Docs: `docs/chats/chat-settings.md`.

**Context**

| Macro | Effect |
|---|---|
| `{{input}}` | Most recent user message (backed by `ctx.lastInput`) |
| `{{agent::TYPE}}` | Saved output of an agent/tracker type — renders only once that agent has run |
| `{{lastGenerationType}}` | A plain label: `normal`, `continue`, `regenerate`, `impersonate`, `guided`, `autonomous`, `turn_game`, `preview`, `game_setup`, `lorebook_scan`, `retry_agents`, … |
| `{{model}}`, `{{chatId}}`, `{{characters}}`, `{{group}}` | Current model, chat id, cast |
| `{{charSysInfo}}`, `{{charPostHistory}}` | Card system prompt / post-history text |
| `{{idle_duration}}`, `{{timezone}}`, `{{time}}`, `{{date}}`, `{{datetime}}`, `{{weekday}}` | Temporal |

**Lorebooks**

| Macro | Effect |
|---|---|
| `{{outlet::name}}` | Content from activated lorebook entries positioned as **Outlet** with a matching outlet name |
| `{{lorebooksize::ID}}` | **(v2.4.4, #5464)** Total entries in the lorebook with that ID (enabled, disabled, and foldered); unknown ID → `0`. Names are case-insensitive, so the changelog's `{{lorebookSize::…}}` works too |
| `{{include::ENTRY}}` / `{{include::BOOK::ENTRY}}` | **(v2.5.0, #6912)** The text of a lorebook entry, by ID or name — reuse one entry's text in other entries, preset sections, or cards |

`{{outlet::name}}` is **case-sensitive** — `{{outlet::character_rules}}` will not match an outlet named `Character_Rules`. It's the precise placement mechanism: the answer to "how do I control exactly where this lorebook entry lands in the prompt." See `lorebooks.md`.

`{{include::}}` lookup: inside an entry a name searches that entry's own lorebook; anywhere else it searches the chat's lorebooks (added to the chat, linked to its characters or persona, global); an ID, or the `BOOK::ENTRY` form, finds the entry in any lorebook even if the chat doesn't use it or it's off. The included entry needn't activate and may be disabled ("include-only" entries); a loop back into itself or a missing entry becomes empty; macros inside the name aren't resolved. Full rules: `lorebooks.md`.

`{{lastGenerationType}}` pairs well with conditional blocks — it lets one card branch between a normal reply, a regenerate, and an impersonation.

**Random:** `{{random}}` (0–100), `{{random:X:Y}}`, `{{random::A::B::C}}` — options are separated by `::`, not commas — with optional relative weights `{{random::Common@1::Rare@0.25}}`, and `{{roll:XdY}}` (e.g. `{{roll:2d6}}` — it resolves even when typed directly into the chat message box).

**Text transforms:** `{{trim}}`, `{{trimStart}}` / `{{trimEnd}}`, `{{uppercase}}…{{/uppercase}}`, `{{lowercase}}…{{/lowercase}}`, `{{newline}}`, `{{noop}}`, and `{{// comment}}` (an author note removed before sending).

**Conditional blocks and Decision statements.** `{{#if …}}…{{else if …}}…{{else}}…{{/if}}` compares with `==` / `=` / `is`, `!=` / `is not` (v2.4.4, #5383), `contains` / `includes` and their `not` forms (case-insensitive), and numeric `>` `<` `>=` `<=`, combined with `||`, `&&`, parentheses, and the equality-list shorthand `{{#if character == "Maukie" || "Pantalone"}}`. **(v2.5.0)** A condition can also ask the optional **Decision model** about the scene: `{{#if decision:"In the latest message, {{user}} asks a direct question"}}` (yes/no) or `{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}` (pick one option), with timing modifiers `sticky:N`, `cooldown:N`, `until:"…"` / `while:"…"`, `every:N`, and `priority:high|low`. That lets a card hold "when flustered…" behavior that is only sent on turns where it applies. Two rules bite card authors: with no Decision model or no answer a statement reads as **no** (the `{{else}}` branch runs); and the model sees **only the statement plus the last 5 messages** — never the card, persona, lorebook, or preset — so a statement that depends on a card fact must spell it out. Full syntax, the **Decision statements per turn** limit, and wording advice: `references/conditional-prompts.md` (engine: `docs/prompts/conditional-prompts.md`).

**Profile / relocation (Conversation):** `{{convo_display}}`, `{{char_about}}`, `{{persona_about}}`, `{{convo_behavior}}`; and the relocation macros `{{context}}`/`{{status}}`, `{{commands}}`, `{{reactRules}}`, `{{replyRules}}`, `{{memories}}`, `{{lorebook}}`, which move an auto-inserted block to where you place it and suppress its automatic insertion.

**Persona/character fields:** `{{description}}`, `{{personality}}`, `{{scenario}}`, `{{appearance}}`, `{{backstory}}`, `{{example}}`, and the `{{persona*}}` equivalents.

> **Gotcha:** `{{message}}` is **not** a macro and never has been. Agent prompt templates render through `renderAgentPromptTemplate` → `buildAgentPromptMacroContext`, which has no `message` key, so it reaches the model as literal text. Use **`{{input}}`**.

### Theming the about-me popout

The Card CSS Theming Guide exposes **`mari-about-me-*` hooks** (e.g. `mari-about-me-popout`, `-box`, `-banner`, `-avatar`, `-name`, `-handle`, `-status`, `-badge`, `-text`), so the Conversation about-me popout is themable straight from **Creator Notes** CSS — and personas can now ship their own creator-notes CSS for their popout too. **(v2.4.2, #4897)** For animated glows, animate `opacity` on an overlay layer, not the bubble's `box-shadow` — animating `box-shadow` repaints every frame and can pin a weak GPU.

## The Professor Mari Pattern

Mari is Marinara's built-in assistant (seeded at first run, cannot be deleted — and since v2.5.0, #6842, not edited either: her card is reset to the built-in version on every start; see `packages/server/src/db/seed-mari.ts`). **As of v2.0 she is the Home-screen assistant, not a normal Conversation-mode chat character** — users talk to her from the Home screen, where a Pi-backed *workspace agent* can inspect the local app and change app data under the review model described below (`packages/server/src/services/professor-mari/workspace-agent.service.ts`; route `POST /api/professor-mari/workspace`). Her card is still the canonical example of a "does-things" assistant. Her definition demonstrates:

### Heavy use of an injected `system_prompt` for domain knowledge
Mari's `system_prompt` is blank in her card, but the server injects a large `MARI_ASSISTANT_PROMPT` when she's the active assistant — the injection is gated by the hardcoded `PROFESSOR_MARI_ID` (`generate.routes.ts`). It contains:
- `<assistant_role>` — framing ("you are not a generic AI, you live inside this app")
- `<app_knowledge>` — the actual Marinara Engine documentation, XML-tagged by section
- `<assistant_commands>` — the hidden actions she can emit (below)
- `<data_access>` — how to use `[fetch: ...]` to load items on demand

**For a custom character with a lot of domain knowledge:** either do what Mari does structurally (large `description` + `system_prompt` with XML-tagged sections) or use a lorebook for the reference material. **(v2.3.4)** The XML-tagged-sections pattern now fully applies to user-authored cards too: leaf content reaches the model verbatim, so your own tags pass through exactly as written (see "Where Each Field Shows Up in the Prompt").

### What Mari can actually do (v2.0)
Her hidden actions are content-creation + navigation helpers, not a generic agent (`docs/PROFESSOR_MARI.md`): create personas, create/update character cards, update personas, create lorebooks (optionally with starter entries), create Conversation/Roleplay chats, navigate to panels/settings tabs, fetch existing items to inspect before advising/editing, and read public Fandom/MediaWiki pages. She is a guide that takes a few *safe* actions — she fetches an item before editing it, and she does **not** run the full Game-Mode setup wizard for you. Beyond the seed-prompt content commands, her Home-screen *workspace agent* can also create/edit **agents, custom tools, and themes** via a `mari` CLI (`mari db` over `agent_configs`/`custom_tools`, `mari themes`). She can also read a chat you attach from her composer (all of it, a range, or the last N messages — v2.4.3, #5073) for grounded feedback, run actions that installed agent packages offer her (`package_service`, Capability API 1.50 — v2.5.0, #6799), and author Decision activation and conditional prompts, checking first that a Decision model is selected (v2.5.0, #6629). **(v2.3.5)** Mari authors **Personal Extensions** again — and she is the *only* author of them, since the Personal Extensions section has no New Draft button and no import control. She writes and saves the draft code; **she cannot approve, enable, or grant it Full page access.** The user must inspect the code, compare the displayed SHA-256 hash, and approve that exact version. (This reverses the v2.3.4 state, when the extension feature and her extension instructions were both removed.) She can also request **review-gated public npm dependencies** for workspace changes: she proposes a root/client/server/shared package, Marinara resolves it to an exact registry version and integrity hash, and waits for the user to approve before installing it with lifecycle scripts disabled. Her raw shell is confined to macOS Seatbelt or Linux Bubblewrap with outbound network denied and fails closed where no sandbox exists; **(v2.5.0, #7146/#7003)** `mari code check` runs inside that sandbox without network or server secrets (where there is no sandbox she asks you to run `pnpm check`), and she can't touch the file protecting saved API keys, write into the saved data folder, or modify the built `dist` folders. See `references/extensions.md`.

**How her changes are approved** *(changed across 2.4.x — earlier guidance said she requests browser approval before database changes)*. She **applies** a change and then shows a **Review Mari's changes** card with **Keep** / **Restore**; creates get one too (v2.4.2, #4825), and a card belongs to the Mari chat it was made in (v2.5.0, #6842). A "how do I…?" question is answered, not performed; a plainly worded request is carried out (v2.4.2, #4838). Once she has asked whether to apply something, that question binds the run: later edits are held (nothing has changed yet) behind a one-click **Accept** (v2.4.4, #5431; binding since v2.4.6, #5748/#5820). **Permissions Mode** (v2.4.6, #5725) sets how forward she is: **Auto** (default — judges from your words and saved memories), **Manual** (describes first, stages only after you accept), **Accept edits** (record edits apply without a review card), **Plan** (never changes anything; mutating commands are refused server-side), **Bypass permissions** (no asking, no review cards). Deletions, sensitive file changes, extension drafts, and dependency installs keep their review in every mode. Pick it per chat from the shield button in her panel header; the default lives under **Settings → General → App Behavior**. Standing preferences go in her **saved memories**, which start disabled until enabled (**Keep & Enable**); a **Persistent** memory's full text is injected every turn, so keep those few and small. `docs/home/professor-mari.md` has the long version.

**(v2.3)** Mari also drafts Conversation **About Me** bios: she inspects the saved character/persona, writes the blurb in their voice, and saves it to the real `aboutMe` field (since v2.4.5 the Character Editor also has its own generate buttons — see the Conversation-mode Profile section). And her card/app-data updates are **field-safe**: partial updates via Mari (or any app-data caller) preserve unrelated fields — greetings, example dialogue, creator notes, system prompts, post-history instructions, character versions, and alternate greetings all survive an update to some other field (#3708); blank Mari generation turns were fixed and lorebook creation made atomic (#3674). **(v2.3.4)** The same field safety now extends to the HTTP layer: partial nested `PATCH /api/characters/:id` requests deep-merge without materializing destructive defaults (#3858) — see API Endpoints.

**(v2.1)** Mari's **preset** support is now *structured*: `app_data` `preset.create` / `preset.update` commands can build prompt groups, prompt sections, and preset variables/choice blocks in a **single reversible operation** (#3207). **(v2.4.2, #4812)** She can also read and change *one* section, prompt group, or choice block in place (also exposed as a `mari presets` CLI) instead of replacing the whole preset, and (v2.4.3, #5080) when she creates a preset variable she also places its `{{variableName}}` macro in a section — a variable only changes the prompt where its macro appears. *(Contributor note: `pnpm mari -- --help` at the repo root exposes the built Mari CLI from a source checkout (#3208); its flag parser was fixed so boolean flags like `--tail`/`--raw`/`--patch` no longer swallow positional args (#3222).)*

### Command protocol vs. real tool calling
Mari uses a **custom regex-parsed command protocol** (`[create_persona: ...]`, `[create_character: ...]`, `[fetch: ...]`, `[navigate: ...]`). This is NOT public — you can't add new meta-commands of your own.

**For custom characters that need to do things, use real Custom Tools** (see `references/custom-tools.md`). They're better supported, use proper OpenAI function-calling, and can be integrated with real backends.

### Personality in character voice
Mari's card description is ~280 words and includes voice, quirks, speech patterns, backstory, appearance, and a few behavioral rules. That's a solid starting length — long enough to establish voice, short enough not to dominate the context window.

### `isBuiltInAssistant: true`
This flag is Mari-specific. The special **prompt injection** is gated by the hardcoded `PROFESSOR_MARI_ID` (not by this flag), so setting the flag on your own character won't make the server inject Mari's assistant prompt or turn it into Mari. The flag itself *does* still drive some scenario/prompt handling (e.g. stripping `<assistant_capabilities>` and a conversation-route branch — `character-prompt-context.ts`, `conversation.routes.ts`), so it isn't entirely inert.

## Recommended Card Structure for Different Use Cases

### Pure roleplay character (fictional persona, creative writing)
- `description` — detailed physical and personality description (~300–800 words)
- `personality` — speech patterns, quirks, MBTI/tropes if useful, behavioral examples
- `scenario` — the setting/context; can be short
- `first_mes` — a compelling opening that establishes voice
- `mes_example` — 2–3 example dialogue exchanges showing voice
- `extensions.appearance` — for image gen (selfies, sprites); if it carries outfit/scene detail, add short image tags in the **Image Appearance Override** rather than trimming the prose
- Lorebook — world info, other NPCs, locations

### Multi-character / scenario card (one card, several people)
- Mark each person with a `[CHARACTER: Name]` header (or repeated `Name:` fields) so the Character Tracker recognizes the cast up front and keeps each one as a separate entry with their own name, state, and portrait, instead of one entry named after the card (v2.4.6, #6104).
- If the cast members should act independently in a group, separate cards are still the cleaner structure.

### "Expert assistant" character (like Mari, for a specific domain)
- `description` — who they are, their expertise, how they speak (~200–400 words)
- `personality` — shorter; focus on how they respond to users
- `system_prompt` — the domain reference material, XML-tagged
- `first_mes` — greeting + menu of what they can help with
- Custom tools — for any actions they can take (see `references/custom-tools.md`)

### "Live data" character (answers questions against current data)
- `description` — thin; mostly voice and framing
- `personality` — how they respond (concise, data-forward, etc.)
- `system_prompt` — rules for using tools ("always call `get_latest` before answering")
- Custom tools — webhook-based, one per lookup type
- Lorebook — any stable background context that doesn't fit in the card

### Group chat member
- Normal character fields, plus:
- `extensions.talkativeness` — tune based on how vocal they should be. **(v2.1)** In merged group Conversations, autonomous-message accounting (saved attribution, follow-up count, per-character daily budget) is charged to the *selected* autonomous character, not the first group member (#3299).
- Clear `personality` — distinguishable voice from other group members
- Lorebook — shared group lore if applicable
- **(v2.3.4)** The **`{{group}}`** macro expands to every other active chat character — including during targeted/manual Roleplay group generation, where the full roster is kept available so it never resolves empty.
- **(v2.3.4)** Roleplay group chats support **per-character Hide From AI**: avatar-based multi-selection, recipient markers, and character-scoped prompt history. The global hide option is preserved. **(v2.4.2)** The same works by command — `/hide <character> <number|range>` (#4906) — and shared or per-character **New Start** markers let a newly introduced character begin from a later message without truncating the rest of the cast's history (#4905).
- Roleplay groups reply either **Merged (Narrator)** (one narrated reply for the whole cast) or **Individual** (one reply per character); since v2.5.0 switching rewrites the whole prompt at once and Chat Settings always shows the mode replies actually use (#6959). **(v2.5.0)** In **Individual** group chats a character can hand the next reply to another available character with an **@mention** (#6567) — one reply per character per turn, and swipes/continues don't hand off.
- **(v2.4.4, #5310)** For big rosters, a custom pre-generation agent with the **Choose active chat characters** capability (`manage_chat_characters`, result type `character_activity_update`) can pick which attached cards take part in each reply, keeping the rest out of that turn's prompt — a cast director and token saver. See `references/agents.md`.

## Import/Export

Characters can be imported from:
- **SillyTavern** — granular per-type import (v2.0 improved the mappings): `st-character` (+ inspect/batch), `st-lorebook`, `st-preset`, `st-chat`, plus `st-bulk/scan` + `st-bulk/run` for importing a whole folder at once (all under `/api/import/*`). Handles characters, lorebooks, presets, and chat history (profile imports restore each group chat's roster — v2.4.4, #5399).
- **The Import Character window** (Characters panel → **Import**) takes `.json`, `.png`, **`.charx`** (Character Card V3 zip, as used by RisuAI) and **`.marinara`** / `.marinara.json` native exports, several at once and mixed. Two batch options: **Imported card tags** (All tags / No tags / Existing only) and **Imported regex scripts** (Character only / Global); a card with a built-in lorebook pauses on **Embedded lorebook found** (**Import Lorebook** / **No Import**). **(v2.4.5, #5624)** Valid image galleries are no longer rejected by byte size.
- **PNG files with embedded metadata** — the V2 spec standard. Drop the PNG into the Characters panel. **(v2.4.2, #4896)** Replacing an existing character's avatar with a *card* PNG also applies that PNG's embedded card fields — use a plain image if you only want a new picture. **(v2.3.5, #4002)** Marinara reads **three** PNG text-chunk types: `tEXt`, `iTXt`, and **compressed `zTXt`**. Character Tavern cards store their data in `zTXt`, which is why they used to fail to import; every parser (Card Browser, file/URL import, SillyTavern bulk import) now handles all three. Re-exporting such a card also **strips the stale compressed chunk** instead of shipping outdated card JSON alongside the current data.
- **JSON files** — raw V2 card JSON.
- **ChubAI, JannyAI, Pygmalion, Wyvern, DataCat** — searchable from the in-app **Card Browser** (renamed from *Bot Browser* in v2.3; provider fetches consolidated behind `safeFetch`, #3617). **(v2.4.2)** The standalone Browser tab is gone: open the Card Browser from the **Download** half of the split **Download / Open Library** control at the top of the **Characters** and **Personas** panels (**Open Library** opens your own library); imports go through a themed Marinara import flow. `docs/characters/bot-browser.md` still describes the older top-bar / **Download Cards** entry points. **CharacterTavern can't be browsed for now (v2.5.0, #7072):** its rebuilt site dropped the connection Marinara used, so picking it shows a notice with **Open CharacterTavern** and **Import Character** buttons — download the card file there and import it (the `zTXt` fix above still applies); the CharacterTavern login was removed.

Characters can be exported (editor header → **Export character**) as:
- **Marinara Native** (`.marinara.json`) — keeps Marinara metadata, sprites, gallery images, and attached lorebooks. The only format **bulk export** produces (Characters panel → **Select** → **Export** → `marinara-characters.zip`), paired with **Bulk select, export, and delete** in the library.
- **Compatible JSON** / **Compatible PNG Card** — plain Chara Card V2 for SillyTavern, Chub, Risu. **(v2.4.6, #6065)** They append non-empty **Backstory** and **Appearance** to `description` (and drop those extension keys so a re-import doesn't duplicate them); the saved card is unchanged. They leave out the gallery, but **(v2.4.4, #5362)** a Compatible PNG carries the sprite set (`extensions.marinara.sprites`, within portable size limits) so it survives a Marinara re-import — `docs/characters/import-export.md` says compatible formats drop sprites; the export code embeds them in the PNG.

**(v2.4.0)** Character **names are whitespace-trimmed** on save and import (#4303). Minor, but it's the explanation for a class of baffling bugs where a trailing space silently broke name matching, macro substitution, or group-speaker prefixes.

## Library organization

Relevant whenever you recommend migrating a SillyTavern library rather than rebuilding it — a bulk import produces a lot of cards, and this is how they stay usable (`docs/characters/library-organization.md`):

- **Favorites** (the `fav` field) and **tag chips** (the `tags` field) for quick filtering; filter by tag from the library.
- **Summary** (v2.4.5; the top-level `summary` field, ≤500 chars) — a short overview the Character Library, card previews, and Home's Character of the Day widget show; **not sent to the model**. **Generate summary** drafts one for review; **Generate missing summaries** fills a bulk selection — handy after a big import.
- **Folders** for grouping.
- **Bulk select, export, and delete** for operating on many cards at once.

> **Folders double as group-chat rosters.** This is the one to remember. A character folder isn't only an organizational bucket — it can seed a group chat's cast. "Put the cast in a folder, then open it as a group chat" is a real workflow, and it should shape how you advise structuring any multi-character project.

## Version history

Character and Persona cards keep a full revision history — the safety net that makes iterating on a card low-risk, and the right answer to *"what if the Card Evolution Auditor changes something I don't like."*

**(v2.3.5, #4040)**
- Restoring an older version **first saves the current card to history**, so the newer version is never lost.
- Each saved version keeps **its own edit timestamp**, not the timestamp of the later save.
- The side-by-side comparison view wraps long unbroken text (URLs, HTML in creator notes) instead of overflowing.

**(v2.4.0, #4040)**
- The **live card appears as the first, explicitly labelled current revision** in the list.
- Saved revisions show **stable sequence numbers** and **second-precision** edit times.

**(v2.4.3, #5202) Automatic versioning**
- Cards start at version `1.0`, and a save that changes the card's content **bumps `character_version`** by its last number (`1.0`→`1.1`, `1.0.0`→`1.0.1`). Non-numeric labels you set (e.g. `AU-beta`) are kept, not reset, and a version you change yourself in the same save wins.
- The **Automatic versioning** switch (`extensions.versioningEnabled`, on by default) pauses both the bumps and the snapshots without deleting existing history. **Reset card versioning** deletes every snapshot and sets the version back to `1.0` (the UI's wording; the docs say `0.0`).

## Game Mode ruleset sheets (v2.5.0)

Characters and personas can hold a **starting build for each installed Game Mode ruleset** — **Stats** tab → **Ruleset sheets** → **Add a sheet**, laid out by the ruleset (lists it fills get **Add from catalog**). Stored in `extensions.rulesetSheets`, keyed by ruleset id, **64 KB per sheet** (`RULESET_SHEET_MAX_BYTES`). A new game on that ruleset copies the sheet; in-game changes never flow back to the card. A sheet for an uninstalled ruleset is kept as one removable line, never sent to the AI, and travels with exports. Separate from **Enable RPG Stats** / **Enable RPG Attributes**: a game on Marinara's own rules ignores ruleset sheets, a game on a ruleset uses them instead of the Attributes. See `references/rulesets.md` and `docs/characters/colors-and-stats.md`.

## Markdown preview (v2.4.0, #4306)

Character, Persona, **and lorebook** text fields have Markdown preview toggles, and library detail views render formatted card text. Practical for authoring: formatting can be checked in the editor instead of round-tripping through a chat to see how it lands.

## Sprite System

Characters can have expression sprites for VN-style overlays in roleplay mode. Sprites live in a folder keyed to the character; filenames are expression names (`happy.png`, `sad.png`, `angry.png`, `smug.png`, etc.) — since v2.4.5 (#5575) a sprite can be renamed after upload without replacing the image. The Expression Engine agent picks the matching sprite per message. There's also an automated sprite generation feature (uses image gen + a pose prompt) introduced in recent versions. **(v2.1)** Expression portraits can additionally be generated as short *animated* sprites: the Expression Engine can drive a Video Generation connection to produce a brief expression clip, convert it to a looping GIF, and save it into the expression slot. Clip length is set under `Advanced > Video Generation` (`animatedExpressionClipDurationSeconds`, default 3s, range 1–8) alongside prompt templates (`packages/shared/src/constants/video-generation-settings.ts`; `packages/server/src/routes/sprites.routes.ts`).

**(v2.3)** Sprite transparency is now **native-alpha-first**: generated sprites prefer the provider's native alpha channel. For providers that can't return transparent PNGs, the pipeline falls back to a subject-aware saturated chroma matte → border-connected soft matting → color despill; the neural background remover is reserved for genuinely complex backgrounds. Legacy white-background sprites remain cleanable, with restore points.

**(v2.3.4)** Sprite downloads route through the **Android native file saver**, and on mobile the editor stacks the Upload control under each expression field (#3884).

### Authoring sprites

`docs/characters/sprites.md` covers the production end the references previously skipped: **Generating sprites with AI**, **Cleaning up sprite backgrounds**, **Exporting sprites**, and **How sprites show up in your chat**. Worth knowing because the skill otherwise only describes sprite *consumption* (the `expression` agent picking one) with no account of where sprites come from.

**(v2.3.5)** Avatar editing was reworked: a non-overlapping miniature **AI wand**, equal **Upload/Generate** actions in Metadata, a downward upload arrow, and accent-colored removal controls.

**(v2.4.2, #4786) Character Sheet** — characters and personas can keep an optional visual identity sheet, separate from the avatar (**Upload Character Sheet** or **Create with AI**). With **Use as reference image** on, image, storyboard, selfie, and video generations prefer the sheet over the avatar for likeness, falling back to the avatar when it's unavailable. Its prompt is the **Character Reference Sheet** template in Settings → Generation (v2.4.4, #5348), and generation can also use the saved neutral full-body sprite as a reference (v2.5.0, #6786).

**(v2.3.5, #3974) Set as avatar** — Character and Persona **Gallery** images can be promoted to the card's avatar from both the grid and the full-size viewer, using path-contained, image-validated server copies. This closes the loop between the Illustrator/Gallery pipeline and the card's identity image, which are otherwise easy to treat as unrelated surfaces.

> **Two galleries, one word.** `docs/characters/galleries.md` distinguishes the **card-level Gallery** from a **chat's gallery**. "Open the Gallery" is ambiguous — say which one.

### Gallery images inside greetings and messages (v2.4.1)

`![alt](card://self/gallery/<file>)` shows an image from **the speaking character's** Gallery — in **First Message**, **Alternate Greetings**, **Example Dialogue**, and any character message, in Roleplay and Conversation alike (the editor's Markdown preview renders it). Hover a gallery image → **Copy image reference** to get the snippet. Use `self`, not the full `card://characters/<id>/…` link: IDs are regenerated on import, while `self` carries no ID and the native importer keeps gallery filenames, so the reference survives a round trip. In a group reply `self` resolves per speaker (falling back to other cast members' galleries in chat order when the speaker lacks the file — give shared-name images distinct filenames). It does **not** work in user or system messages, nor for persona galleries (use `card://personas/<id>/gallery/<file>`).

> **Ship the native export.** **PNG card exports don't include the gallery**, so every gallery reference breaks after a PNG-only share. A card that uses gallery images should go out as **Marinara Native** (`.marinara.json`).

## Sprites → Clips (Video-Call Presence) (v2.1)

Distinct from the VN expression **Sprite System** above, both the **Character *and* Persona editors** gained a **Sprites → Clips** tab holding reusable *video-call presence clips* — short avatar videos played during Conversation-mode audio/video calls. There are **six fixed clip kinds** — `idle`, `talking`, `laughing`, `angry`, `crying`, `sighing` (`CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS`, `packages/shared/src/types/conversation-call.ts:10-26`) — plus **named custom clips**, capped at **128 per character** (`CUSTOM_CLIP_LIMIT = 128`, `packages/server/src/services/conversation/call-character-videos.service.ts:115`).

Each clip carries a `status` (`missing | generating | ready | error`) and an `origin` (`generated | uploaded`). Clips can be **generated per-slot** from an empty or errored card (no full batch required) or **uploaded as MP4** (bounded by `CALL_VIDEO_CLIP_UPLOAD_MAX_BYTES`); uploads support **non-destructive trim** via `trimStartSeconds` / `trimEndSeconds` (`conversation-call.ts:95-96,109-110`). The per-character/-persona manifest is `ConversationCallCharacterVideoManifest` (`clips[]` + `customClips[]`, `conversation-call.ts:88-121`), served at `GET /api/characters/:id/gallery/clips` (`packages/server/src/routes/characters.routes.ts:768`).

### Character Video Presence
When `callCharacterVideoEnabled` is on (`packages/shared/src/types/tts.ts:146`, default `false`) Marinara uses the **'Default for Videos'** connection to play these cached avatar clips **in-call**, cued from TTS output and returning to `idle` after speech. `callAutomaticVideoClipsEnabled` (`tts.ts:148`) auto-generates the minimum `idle`/`talking` clips. (The clips themselves are produced by the Video Generation subsystem — see `references/architecture.md`.)

### In-call commands ([custom_clip], [react:])
In **call-only** chat a character can emit two hidden, engine-parsed commands. These are regex-parsed like Mari's protocol (below) and are **engine-emitted & gated, not user-authorable meta-commands or public custom tools** — a card author does not write them into `first_mes`/`mes_example`:
- `[custom_clip: label="short title", prompt="visual action or look"]` — generates one custom call clip and saves it into that character's **Sprites → Clips** custom library (cap 128). Note the **real bracket-arg syntax** (a `label` and a `prompt`); a bare `[custom_clip]` is *not* valid. Double-gated by `callCharacterVideoEnabled && callCustomVideoClipsEnabled` (`tts.ts:150`) and only offered when a video connection exists (`packages/server/src/routes/conversation-calls.routes.ts:736-740,1060`).
- `[react: emoji="😂"]` (also `[react: emoji=":custom_name:"]`) — reacts to the user's latest written call message (`conversation-calls.routes.ts:734`).

(The broader Conversation-mode `[react:]` grammar, including character-to-character targeting, is documented in `references/architecture.md`.)

## Common Mistakes

- **Putting everything in `description`** — fine up to ~1000 words, bad past that. Split into `personality`, `scenario`, and `system_prompt` (or use a lorebook). The Library / Characters panel token estimate counts the **whole** card — example messages, alternate greetings, instructions, embedded lore (v2.5.0, #6255) — so use it to see the real cost.
- **Writing examples in narrative instead of dialogue** — `mes_example` is for teaching voice. Show dialogue exchanges, not backstory. **(v2.3.4)** All prompt leaf content now reaches the model **verbatim** — `<START>` needs no special-casing, and angle-bracket markup / inline HTML in card fields, persona, lorebooks, memories, and scene text passes through exactly as written. You can use XML tags and HTML deliberately, but proofread for stray pseudo-XML, because that goes to the model as-is too. (Supersedes the v2.3 #3623 escaping model; structural section wrappers and agent value/attribute escapers are unchanged.)
- **Forgetting `first_mes`** — without it, the character opens the chat with nothing, and the model often misinterprets silence.
- **Treating `system_prompt` as a preset override** — it doesn't replace the preset's system prompt; it's sent alongside the card's other fields through the preset's character block (Advanced tab, `docs/characters/creating-and-editing-characters.md`). Use it for character-specific rules; change the preset itself to change global framing. *(Corrected at the v2.5.0 sync — earlier guidance said it replaced the preset's system prompt.)*
- **Not setting `extensions.appearance`** — breaks selfie generation and image prompts.
- **Fighting outfit leakage by gutting `appearance`** — if clothing or scene detail from **Appearance** keeps showing up in every illustration, turn on the **Image Appearance Override** (v2.5.0) and give image models short tags instead; the narrator keeps the full text.
- **Using purple-prose descriptions** — cram too many adjectives in and the model starts writing florid overwrought prose. Be concrete.
- **Expecting the character to "remember" stuff you didn't put in a prompt** — the card + lorebook + history is all the model sees. Per-chat state belongs in variable macros / Chat Variables (above); only persistence *outside* a chat needs a tool that writes to your own backend.
- **"Missing" characters that are really a stale filter** — on ≤2.3.2, a saved Character-panel search/tag/favorite filter could persist and hide cards. **(v2.3)** Panel filters are now session-only (stale ones were reset); Full Library sorting and position preferences still persist.

## API Endpoints

Characters (`/api/characters`, non-exhaustive — see `packages/server/src/routes/characters.routes.ts`). **(v2.3.4)** The editor's **Copy ID** control (handy for grabbing the `:id` these routes take) now works on mobile and non-secure contexts, with confirmed-success reporting (#3851).
- `GET /` — list; `GET /:id` — one
- `POST /` — create; `PATCH /:id` — update; `DELETE /:id` — delete. **(v2.3.4)** Partial nested `PATCH`es **deep-merge** without materializing destructive defaults — omitted `extensions` keys and embedded-lorebook data survive (#3858) — and native cards are validated/normalized **before persistence**, preserving unknown embedded-lorebook properties (#3859).
- `GET /:id/export` (JSON, with a `format` querystring) **and** `GET /:id/export-png` (PNG with embedded V2 metadata) — these are **two separate endpoints**, not one parameterized export
- `POST /export-bulk` — bulk export
- `POST /:id/duplicate`; `GET /:id/versions`, `POST /:id/versions/:versionId/restore`
- `GET /:id/gallery` (+ `/gallery/upload`, `/gallery/:imageId`), `POST /:id/avatar`, `DELETE /:id/avatar`
- **(v2.1)** Galleries now hold **images *and* videos** — Character/Persona galleries split into **Images / Videos** tabs (the old 'clips' were renamed 'Videos'). Video + clip routes (persona mirror ~`characters.routes.ts:1823`): `GET /:id/gallery/videos/file/:filename`, `POST /:id/gallery/videos/upload`, `POST /:id/gallery/clips/upload`, `PATCH /:id/gallery/clips/:clipId/trim`, `DELETE /:id/gallery/clips/:clipId`. MP4 upload for both gallery videos and Sprites → Clips, non-destructive trim, and delete; custom-clip library capped at 128, uploads bounded by `CALL_VIDEO_CLIP_UPLOAD_MAX_BYTES`.
- `POST /:id/embedded-lorebook/import`
- Groups: `GET /groups/list`, `GET /groups/:id`, `POST /groups`, `PATCH /groups/:id`, `DELETE /groups/:id` (note `/groups/list`, not `GET /groups`)

**Import is a separate router at `/api/import/*`** — there is no `POST /api/characters/import`. Relevant endpoints: `POST /api/import/st-character` (+ `/st-character/inspect`, `/st-character/batch`), `POST /api/import/marinara`, `POST /api/import/marinara-package`, plus `/st-preset`, `/st-lorebook`, `/st-bulk/scan`, `/st-bulk/run` (`packages/server/src/routes/import.routes.ts`).

*(AI-assisted character generation moved to `POST /api/professor-mari/workspace` in v2.0; the old `/api/character-maker/generate` route and its maker modal were removed.)*
