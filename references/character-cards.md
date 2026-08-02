# Character Cards

Characters in Marinara Engine follow the **V2 Character Card spec** (`chara_card_v2`), with Marinara-specific extensions. A character is a JSON object stored via Marinara's file-native storage (under `DATA_DIR/storage`; SQLite is legacy) and rendered through the Characters Panel UI.

**Source of truth:** `packages/shared/src/schemas/character.schema.ts` and `packages/server/src/db/seed-mari.ts` (the built-in Professor Mari assistant is the canonical example of a complex card).

## The V2 Card Schema

```typescript
{
  name: string,                     // required
  description: string,              // the main character description
  personality: string,              // traits, speech style, quirks
  scenario: string,                 // the setting / framing
  first_mes: string,                // the character's opening message
  mes_example: string,              // example dialogue (teaches the model voice)
  creator_notes: string,            // not sent to model; for other users
  system_prompt: string,            // overrides the user's global system prompt
  post_history_instructions: string, // instructions inserted after message history
  tags: string[],
  creator: string,
  character_version: string,
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
    aboutMeSources: { ... },        // legacy (v2.3): former AI-write source picker; no longer surfaced by the editors
    // (the extensions object still allows arbitrary passthrough keys too)
  },
  // phoneticName lives as a top-level character/persona column (not in extensions):
  phoneticName: string,             // pronunciation spelling for Conversation Call TTS
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
| `mes_example` | yes | The last card section in the prompt (after `scenario`); teaches the model voice. |
| `system_prompt` | yes | Replaces the preset's system prompt section if non-empty. |
| `post_history_instructions` | yes | Inserted at the end, after recent messages. |
| `tags`, `creator`, `creator_notes` | no | Metadata, not sent to model. |
| `extensions.appearance` | yes | An ordered card section (between `backstory` and `scenario`); also used in image generation. |
| `extensions.backstory` | yes | An ordered card section (between `personality` and `appearance`). |
| `extensions.depth_prompt` | yes | Inserted at N messages deep. |
| `extensions.talkativeness` | no (structurally) | Used by autonomous messaging logic. |
| `character_book` (embedded lorebook) | yes | Entries trigger normally based on keywords. |

**Practical implication:** anything you want the model to *always* know goes in `description` / `personality` / `system_prompt`. Anything it only needs when a keyword is mentioned goes in the lorebook (either character-scoped or a separate file).

**(v2.2)** The advanced prompt fields — `system_prompt`, `post_history_instructions`, and `extensions.depth_prompt` — now apply across **Conversation and Game modes too**, not just Roleplay. A card built for Conversation can carry the same system/post-history/depth steering it would in Roleplay.

**(v2.3.4)** Card sections keep a **guaranteed order** in the prompt — Description → Personality → Backstory → Appearance → Scenario → then Example Dialogue when present — and that order holds across preset markers, fallbacks, agent lore, and Game/scene card contexts (#3817).

**(v2.3.4)** Field content reaches the model **verbatim**: angle brackets in card fields, persona, lorebook entries, memories, and scene text are no longer HTML-escaped, so `<thinking>`, `<scenario>`, or an inline `<div>` pass through exactly as written. Deliberate XML/HTML markup is now a supported authoring tool (structural section wrappers and agent value/attribute escapers are unchanged) — see Common Mistakes for the flip side.

## Character vs. Persona: A Critical Distinction

**Character** = an AI entity the user chats with.
**Persona** = the user's own identity in the chat.

They have similar fields but serve opposite roles. If the user asks "how do I give my character a detailed backstory," you're building a character. If they ask "how do I tell the AI about *me*," you're building a persona. The engine substitutes `{{user}}` in prompts with the active persona's name and injects the persona's data into the prompt too. **(v2.3)** Two caveats: a **Roleplay chat created with no Persona stays persona-less end-to-end** (first snapshot, provider prompt, scene generation, combat context) — only Conversation falls back to the globally active Persona. And `{{user}}` / `{{char}}` and other macros in `first_mes`, alternate greetings, and `/guided` instructions now resolve at the **final provider boundary** — including lorebook routing and embedding scans — so raw placeholders can no longer reach the model (#3704). **(v2.3.4)** Name Prefix History is now **persona-accurate per turn**: historical user turns stay labeled with the Persona that actually sent them, so switching Personas no longer rewrites earlier prefixes.

**(v2.3)** Both a character's metadata and a persona's lead their primary identity block with a clearly labeled **avatar upload/replace field** (same upload/crop flow as the editor portrait), above **Name** and the **Title / comment** field (synced with the editor-header field) — a short human label for the card, distinct from the model-facing `name`. **(v2.3)** Personas also gained an **Open Full Library** mirroring the Character Library — card grid, search, sorting, preview pane, paging, scroll restoration, and the editor return flow; both libraries use the Settings chroma text color. **(v2.3.4)** Editor polish: tracker-card color settings preview immediately and persist, and cropped avatars stay contained in their editor upload targets and no longer hijack page clicks (#3741/#3939).

## Conversation-mode Profile

These fields live on the character/persona `extensions` schema (`character.schema.ts:30-74`) and are **Conversation-mode only** — they're never sent in Roleplay / VN / Game mode. Characters and personas carry the same profile columns, and Professor Mari's `character.create` / `persona.create` (and `mari personas create`) can populate them.

- **`convoDisplayName`** — a live sender label shown above the character's messages, distinct from the card `name`. The **`convoDisplayNameInCard`** toggle additionally declares the display name inside the prompt so the model maps it back to the card — mainly useful in **group Conversations**, where generation instructions, speaker parsing, labels, typing events, and base-name matching all honor it.
- **`aboutMe`** — a Discord-style "about me" blurb surfaced in the participant popout. **(v2.3)** AI drafting now goes through **Professor Mari**: she inspects the saved character/persona, writes the bio in their voice, and saves it to the real `aboutMe` field. The Character and Persona Convo editors no longer expose a separate model connection or source settings for it — the old gear-icon source picker is gone, and **`aboutMeSources`** survives only as a **legacy schema field** the editors don't surface. The field itself is unchanged.
- **Per-chat about-me override** — separate from the card default. In Conversation mode, click a participant's avatar to set/edit/clear a **chat-specific** about-me that supersedes the card default in that one conversation (Discord per-server-profile style; pairs with the `update_about_me` tool's `chat` scope).
- **`convoBehavior`** — a Conversation-only behavior directive (`instruction` text plus an `insertionStrategy`). Strategies: `constant_before`, `constant_after` (default), `post_history_replace`, `post_history_before`, `post_history_after`, and `macro` (place it yourself with `{{convo_behavior}}`).
- **`phoneticName`** (top-level column, `phonetic_name`) — a pronunciation spelling used by Conversation Call TTS. Exposed via `{{charNamePhonetic}}` / `{{userNamePhonetic}}`, which fall back to `{{char}}` / `{{user}}` when empty.

### Conversation macros

Conversation mode registers a `Conversation` macro category (`packages/shared/src/utils/macro-engine.ts:284-363`). Profile macros pull the fields above: `{{convo_display}}`, `{{char_about}}`, `{{persona_about}}`, `{{convo_behavior}}`. **Relocation macros** move an auto-inserted block to where you place it (and skip its automatic insertion): `{{context}}` / `{{status}}`, `{{commands}}`, `{{reactRules}}`, `{{replyRules}}`, `{{memories}}`, `{{lorebook}}`.

**(v2.3.4)** Two macro additions usable in card text generally (not Conversation-only): **`{{group}}`** expands to every other active chat character — it works during targeted Roleplay group generation too, and the full roster is kept available in manual group generation so it never resolves empty — and **conditional prompt macros** now support `||` (OR), `&&` (AND), parentheses, and an equality-list shorthand, with examples in-app.

### Character-ID macros (v2.4.0, #4336)

To reference a character **who is not part of the current chat**, copy that card's ID and put it directly inside double braces:

```text
{{V1StGXR8_Z5jdHi6B-myT}}
```

Marinara replaces the macro with **the card's name** and adds **that card's character context to the system prompt**. Specifically:

- The referenced card's **initial greetings and example dialogue are excluded** — you get the character description, not their conversational scaffolding.
- **Lorebooks attached to the referenced card still activate normally**, subject to their usual keyword, constant, filter, probability, and token-budget rules.

**Why this matters for ideation.** This is the clean answer to "my character should know about their sister / rival / mentor who exists as their own card, but I don't want them in the chat." Previously the options were duplicating the description into the card (drift, token cost) or a lorebook entry restating it (a second source of truth). Now one card is the single source and other cards reference it by ID.

**Caveats to state when recommending it:**
- It pulls the **whole** character context every time the macro resolves, so it is not free — don't scatter it across a dozen references in one card.
- It's an ID, not a name, so the card text becomes opaque to a human reader. Suggest a nearby comment noting who the ID belongs to.
- If the referenced card is deleted, the reference breaks. For a stable shared canon that several cards depend on, a **lorebook** is still the more robust structure — use Character-ID macros for genuine character-to-character references.

Docs: `docs/prompts/macros.md`.

### Theming the about-me popout

The Card CSS Theming Guide exposes **`mari-about-me-*` hooks** (e.g. `mari-about-me-popout`, `-box`, `-banner`, `-avatar`, `-name`, `-handle`, `-status`, `-badge`, `-text`), so the Conversation about-me popout is themable straight from **Creator Notes** CSS — and personas can now ship their own creator-notes CSS for their popout too.

## The Professor Mari Pattern

Mari is Marinara's built-in assistant (seeded at first run, cannot be deleted; see `packages/server/src/db/seed-mari.ts`). **As of v2.0 she is the Home-screen assistant, not a normal Conversation-mode chat character** — users talk to her from the Home screen, where a Pi-backed *workspace agent* can inspect the local app and request browser approval for database changes (`packages/server/src/services/professor-mari/workspace-agent.service.ts`; route `POST /api/professor-mari/workspace`). Her card is still the canonical example of a "does-things" assistant. Her definition demonstrates:

### Heavy use of an injected `system_prompt` for domain knowledge
Mari's `system_prompt` is blank in her card, but the server injects a large `MARI_ASSISTANT_PROMPT` when she's the active assistant — the injection is gated by the hardcoded `PROFESSOR_MARI_ID` (`generate.routes.ts`). It contains:
- `<assistant_role>` — framing ("you are not a generic AI, you live inside this app")
- `<app_knowledge>` — the actual Marinara Engine documentation, XML-tagged by section
- `<assistant_commands>` — the hidden actions she can emit (below)
- `<data_access>` — how to use `[fetch: ...]` to load items on demand

**For a custom character with a lot of domain knowledge:** either do what Mari does structurally (large `description` + `system_prompt` with XML-tagged sections) or use a lorebook for the reference material. **(v2.3.4)** The XML-tagged-sections pattern now fully applies to user-authored cards too: leaf content reaches the model verbatim, so your own tags pass through exactly as written (see "Where Each Field Shows Up in the Prompt").

### What Mari can actually do (v2.0)
Her hidden actions are content-creation + navigation helpers, not a generic agent (`docs/PROFESSOR_MARI.md`): create personas, create/update character cards, update personas, create lorebooks (optionally with starter entries), create Conversation/Roleplay chats, navigate to panels/settings tabs, fetch existing items to inspect before advising/editing, and read public Fandom/MediaWiki pages. She is a guide that takes a few *safe* actions — she fetches an item before editing it, and she does **not** run the full Game-Mode setup wizard for you. Beyond the seed-prompt content commands, her Home-screen *workspace agent* can also create/edit **agents, custom tools, and themes** via a `mari` CLI (`mari db` over `agent_configs`/`custom_tools`, `mari themes`), requesting browser approval before database changes. **(v2.3.5)** Mari authors **Personal Extensions** again — and she is the *only* author of them, since the Personal Extensions section has no New Draft button and no import control. She writes and saves the draft code; **she cannot approve, enable, or grant it Full page access.** The user must inspect the code, compare the displayed SHA-256 hash, and approve that exact version. (This reverses the v2.3.4 state, when the extension feature and her extension instructions were both removed.) She can also request **review-gated public npm dependencies** for workspace changes: she proposes a root/client/server/shared package, Marinara resolves it to an exact registry version and integrity hash, and waits for the user to approve before installing it with lifecycle scripts disabled. Her raw shell is confined to macOS Seatbelt or Linux Bubblewrap with outbound network denied and fails closed where no sandbox exists. See `references/extensions.md`.

**(v2.3)** Mari also drafts Conversation **About Me** bios: she inspects the saved character/persona, writes the blurb in their voice, and saves it to the real `aboutMe` field (the per-editor AI Write controls were removed — see the Conversation-mode Profile section). And her card/app-data updates are **field-safe**: partial updates via Mari (or any app-data caller) preserve unrelated fields — greetings, example dialogue, creator notes, system prompts, post-history instructions, character versions, and alternate greetings all survive an update to some other field (#3708); blank Mari generation turns were fixed and lorebook creation made atomic (#3674). **(v2.3.4)** The same field safety now extends to the HTTP layer: partial nested `PATCH /api/characters/:id` requests deep-merge without materializing destructive defaults (#3858) — see API Endpoints.

**(v2.1)** Mari's **preset** support is now *structured*: `app_data` `preset.create` / `preset.update` commands can build prompt groups, prompt sections, and preset variables/choice blocks in a **single reversible operation** (#3207). *(Contributor note: `pnpm mari -- --help` at the repo root exposes the built Mari CLI from a source checkout (#3208); its flag parser was fixed so boolean flags like `--tail`/`--raw`/`--patch` no longer swallow positional args (#3222).)*

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
- `extensions.appearance` — for image gen (selfies, sprites)
- Lorebook — world info, other NPCs, locations

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
- **(v2.3.4)** Roleplay group chats support **per-character Hide From AI**: avatar-based multi-selection, recipient markers, and character-scoped prompt history. The global hide option is preserved.

## Import/Export

Characters can be imported from:
- **SillyTavern** — granular per-type import (v2.0 improved the mappings): `st-character` (+ inspect/batch), `st-lorebook`, `st-preset`, `st-chat`, plus `st-bulk/scan` + `st-bulk/run` for importing a whole folder at once (all under `/api/import/*`). Handles characters, lorebooks, presets, and chat history.
- **PNG files with embedded metadata** — the V2 spec standard. Drop the PNG into the Characters panel.
- **JSON files** — raw V2 card JSON.
- **Chub.ai, CharacterTavern, JannyAI, Pygmalion, Wyvern, DataCat** — all searchable from the in-app **Card Browser**. **(v2.3)** Renamed from *Bot Browser*; the *Browse Online* entry point is now **Download Cards**, and the online browser opens as the **Cards Library** in the shared library shell. Provider fetches (Chub/CharacterTavern/Wyvern) were consolidated behind `safeFetch` (#3617).

Characters can be exported as:
- JSON (via the export endpoint)
- PNG with embedded V2 card metadata (via the export endpoint)

## Sprite System

Characters can have expression sprites for VN-style overlays in roleplay mode. Sprites live in a folder keyed to the character; filenames are expression names (`happy.png`, `sad.png`, `angry.png`, `smug.png`, etc.). The Expression Engine agent picks the matching sprite per message. There's also an automated sprite generation feature (uses image gen + a pose prompt) introduced in recent versions. **(v2.1)** Expression portraits can additionally be generated as short *animated* sprites: the Expression Engine can drive a Video Generation connection to produce a brief expression clip, convert it to a looping GIF, and save it into the expression slot. Clip length is set under `Advanced > Video Generation` (`animatedExpressionClipDurationSeconds`, default 3s, range 1–8) alongside prompt templates (`packages/shared/src/constants/video-generation-settings.ts`; `packages/server/src/routes/sprites.routes.ts`).

**(v2.3)** Sprite transparency is now **native-alpha-first**: generated sprites prefer the provider's native alpha channel. For providers that can't return transparent PNGs, the pipeline falls back to a subject-aware saturated chroma matte → border-connected soft matting → color despill; the neural background remover is reserved for genuinely complex backgrounds. Legacy white-background sprites remain cleanable, with restore points.

**(v2.3.4)** Sprite downloads route through the **Android native file saver**, and on mobile the editor stacks the Upload control under each expression field (#3884).

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

- **Putting everything in `description`** — fine up to ~1000 words, bad past that. Split into `personality`, `scenario`, and `system_prompt` (or use a lorebook).
- **Writing examples in narrative instead of dialogue** — `mes_example` is for teaching voice. Show dialogue exchanges, not backstory. **(v2.3.4)** All prompt leaf content now reaches the model **verbatim** — `<START>` needs no special-casing, and angle-bracket markup / inline HTML in card fields, persona, lorebooks, memories, and scene text passes through exactly as written. You can use XML tags and HTML deliberately, but proofread for stray pseudo-XML, because that goes to the model as-is too. (Supersedes the v2.3 #3623 escaping model; structural section wrappers and agent value/attribute escapers are unchanged.)
- **Forgetting `first_mes`** — without it, the character opens the chat with nothing, and the model often misinterprets silence.
- **Setting `system_prompt` without understanding it replaces the preset's system prompt** — you lose any framing the preset provides. Usually you want to leave `system_prompt` blank unless you specifically need to override.
- **Not setting `extensions.appearance`** — breaks selfie generation and image prompts.
- **Using purple-prose descriptions** — cram too many adjectives in and the model starts writing florid overwrought prose. Be concrete.
- **Expecting the character to "remember" stuff you didn't put in a prompt** — the card + lorebook + history is all the model sees. If you want persistence outside a chat, use a tool that writes to your own backend.
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
