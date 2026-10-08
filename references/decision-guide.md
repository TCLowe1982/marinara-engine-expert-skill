# Decision Guide: Picking the Right Architecture

This is the consultant's main reference. When a user describes a goal, walk through these questions in order. Stop at the first one that fits.

## First: which chat mode?

Before architecture, pick the **mode** the experience runs in — this is orthogonal to the surfaces below (a card + lorebook + tools stack works in any of them). There are exactly three modes (`chatModeSchema`): Conversation, Roleplay, Game.

- **Conversation** — default one-on-one (or small group) chat. Pick it for an assistant, a companion, or a straightforward back-and-forth. Multi-character Conversations support **Grouped** or **Individual** response modes with sequential, smart, manual, mention-directed, or autonomous character selection (2.3.4, #3887); mentioning a character always selects the mentioned responder(s) (#3891). With a Decision model, **Smart response order** can pick who answers next (2.5.0). Autonomous check-ins draw from a shared daily budget with a token-use warning. Since 2.5.0 an Individual group paces them like a one-on-one chat — characters who have waited long enough take turns, and a long absence produces one check-in instead of a burst — so autonomous groups no longer burn the day's budget right after midnight.
- **Roleplay** — immersive narrative RP with a character or cast; the model narrates scenes and drives story. Pick it for story and character immersion. Roleplay is where the 2.4.6–2.5.0 features concentrate: the optional **Visual Novel display** (Classic or Visual Novel, chosen in setup or Appearance → Roleplay — a display style, *not* a mode), opt-in **Roleplay Commands** (Q6), and **Advanced Memory Recall** (Q6).
- **Game** — GM-driven interactive fiction (Game Mode): the engine runs a game master over narration, storyboards, and scene beats. Pick it for structured, quest-like play. The new-game wizard has three choices that shape it:
  - **Rules** (2.5.0) — "Marinara's own rules" by default, or an installed **Game Mode ruleset** (D&D 5e, the user's own system). See Q6 and `references/rulesets.md`.
  - **Combat Preference** (2.3) — classic narrative combat or tactical grid battles with four difficulty levels; changeable later via Chat Settings → Combat Style.
  - **Experiences** — package-provided whole-game UIs (`game-surface`, 2.4.1), fixed for the game's lifetime.

  The wizard also chooses **Game Master Mode** — **Standalone GM** (default) or **Character GM** (one of the user's cards runs the game). Game setups export/import as reusable `.marinara-game-setup.json` bundles that refill the New Game wizard (and carry the chosen ruleset). There is no in-app checkpoint restore, so don't offer "load an old checkpoint" as an undo.

**Not a mode:** **Noodle** (the fake social network) and **Slurp** are downloadable **App** packages since 2.4.2. Install from Agents → Download Agents, restart, and open from the Home tab. Pick one for a living multi-character social feed rather than a direct chat; social memory carries over into the three modes. See `references/architecture.md`.

## The Decision Questions

Walk them in order and stop at the first that fits. **Questions 1–9 map one-to-one to the decision hierarchy in SKILL.md** — same order, same numbers; this file is the long version with examples. Questions 10 and 11 are routing questions that sit outside that ladder (media generation, text transforms).

### 1. Is the entire knowledge set small and completely stable?
**Small** = under ~2000 tokens of reference material. **Stable** = won't change for months.

→ **Put it in the character card.** Use `description` for the personality/role, `system_prompt` for reference knowledge, XML-tagged sections for structure. This is the Professor Mari pattern in its purest form, minus the assistant commands.

**Fits:** Planet Zoo modding reference, a D&D 5e rules summary *for explaining the rules* (to actually **play** 5e in Game Mode, see Q6 — rulesets), a specific setting's lore, a company's style guide.

**Doesn't fit:** Anything that needs updates more than quarterly, anything with entity lookup patterns ("tell me about character X out of 200").

---

### 2. Is the knowledge large but organized into discrete, lookup-shaped entries?
**Discrete entries** = you can imagine queries like "tell me about X" where X is a keyword. **Large** = too big for the prompt (> 2k tokens) but finite (< a few MB of text).

→ **Use a lorebook with keyword triggers.** Each entry has keys (the trigger words), content (the text that gets injected), and optional config (constant/ephemeral/grouped/recursive). Two 2.5.0 additions widen what fits here:
- **`{{include::Entry}}`** (or `{{include::Lorebook::Entry}}`) inserts one entry's text into another entry, a preset, or a card — so shared canon lives in **one** place instead of being duplicated.
- **Reference images** on an entry (PNG/JPEG/WebP plus captions) go to image-capable models when the entry activates. Route "the model should know what X *looks* like" here; text-only models get the captions instead.

**Fits:** WoW raid boss mechanics, a fantasy world's 300 named characters, a law firm's internal case-law citations, a tech company's product catalog, a wardrobe of outfits with reference pictures.

**Doesn't fit:** Knowledge where the query isn't obviously keyword-shaped ("summarize yesterday's news," "what's trending on Reddit right now").

See `references/lorebooks.md` for entry fields and tuning. **Note:** entry `probability` is a **0–100 percentage**, not 0–1.

---

### 3. Should text or lore appear only in some situations?
The content is stable, but it should only apply when something is true — the scene is a fight, the character is drunk, the party has met the duke, it's night.

→ **Deterministic first.** If exact terms or tracked state capture the situation, use **lorebook keywords** or a **`{{#if}}` conditional** on a macro or Chat Variable — no extra model call, no latency, and it behaves the same for every user.

→ **Then a Decision model** (2.5.0) when paraphrase or mood matters ("the scene has turned romantic," "someone is lying"):
- **`{{#if decision:"…"}}`** / **`decision_choice`** statements in presets, cards, entries, and agent prompts.
- A lorebook entry's **Decision** field — **Require** (keywords *and* the statement must hold) or **Trigger** (the statement alone can activate it).
- A custom agent's **Activation question**.

Decision models are optional and global, and they read only the statement plus the last few messages — never cards, lore, or the preset. With no model or no answer, a statement reads as **no**.

**Rules:** keep a non-decision fallback route for anything that matters (Require can't admit and Trigger adds no route without a model). **Never** gate consent, content warnings, or safety text on a decision.

**Fits:** mood-dependent narration rules, an entry that should only fire when a topic is really being discussed (not merely mentioned), an agent that should only run "when the scene moves somewhere new."

**Doesn't fit:** anything a keyword or a variable already decides reliably.

See `references/conditional-prompts.md`.

---

### 4. Does the knowledge change frequently (weekly or faster)?
**Frequently** = there's a live authoritative source somewhere (an API, a scraper, a RSS feed, a database, a spreadsheet).

→ **First, is general web search enough?** The built-in **`web_search`** tool (title/URL/snippet results, up to 8) covers "what's in the news about X" with no backend — enable it for the chat (see `references/custom-tools.md` → Built-In Tools).

→ **Otherwise, a custom tool with `webhook` execution** — for a specific authoritative source. Stand up a tiny backend (Cloudflare Worker, n8n, Express on a VPS, Zapier webhook) that the character can call. Return JSON to the model.

**Fits:** Path of Titans meta (patch notes change per release), sports scores, stock prices, your band's next show, "what's in the news about X."

**Doesn't fit:** Knowledge that's stable but you just haven't written it down yet (write it down — use lorebook or card).

See `references/custom-tools.md` for the webhook pattern.

---

### 5. Does the character need to perform **actions** — not just answer?
Actions = effects in the world. Creating a file, updating a row in your DB, sending a Slack message, triggering a workflow, fetching a specific record.

→ **Custom tool.** Static for stubs and testing. Webhook for anything that reaches outside the engine (network calls, databases, third-party APIs). Script for pure computation (math, string transforms, date calculations) where no I/O is needed.

**Capabilities that are NOT hand-built custom tools:**
- **Generating or animating images/video** is a *native* capability — see Q10.
- **Controlling a Home Assistant setup** — install the **Marinara Engine** integration in Home Assistant through **HACS**. It creates a fixed set of smart-home Functions (lights, climate, covers, media players, and more) plus a **Home Assistant** agent you add to each chat; you never write the tools yourself. Needs `WEBHOOK_LOCAL_URLS_ENABLED=true`, since HA's webhook is local plain HTTP. Don't hand-edit the generated tools: **Marinara Sync HA Tools** (on the HA device page) overwrites edits and re-enables them. See `docs/integrations/home-assistant.md`.
- **Rolling dice, keeping secrets, sending in-world letters or DMs in Roleplay** — built-in Roleplay Commands (Q6).

**Fits:** "Look up the WordPress config for client X," "create a character based on this description" (this is literally what Mari does), "compute the optimal grow schedule given these inputs."

**Critical reminder:** The `script` execution type is **disabled by default** — it only runs if the server sets `CUSTOM_TOOL_SCRIPT_ENABLED=true`. It runs in a terminable QuickJS worker (2.4.2) with **no network, no filesystem, no environment variables or secrets, no `require()`**, under the shared custom-tool timeout (60s default, `CUSTOM_TOOL_TIMEOUT_MS`). If the action needs anything outside pure JS computation, it must be a `webhook`. Imported **webhook and Script** tools both arrive **disabled** until reviewed (2.4.2).

See `references/custom-tools.md` for the full execution-type breakdown.

---

### 6. Does something built in, or an official package, already do this?
Check this **before** designing a custom agent, tool, or extension. Recent releases built in a lot of what people used to hand-roll:

- **Roleplay Commands** (2.4.6, Chat Settings → Agents → **Commands**; each one starts **off**). In-message commands for:
  - **Whisper** (2.5.0, #6616) — a private aside that only the recipient (a character or your persona) and the appointed narrator receive. You can also type whispers in your own messages.
  - **Personal Notes** — a character's private motives, lies, and plans, carried across turns.
  - **Reminders**, in-world **documents**, real **dice rolls**, and **direct messages**.
  - **Interruptions** — a character cuts off the previous message.
  - **Combat** (needs the Combat agent in the chat), **Illustrations** (needs Illustrator), **Soundtrack** (needs Music DJ), and **Sound Cues** (need an ElevenLabs Audio connection with sound effects on).

  Notes, documents, and whispers follow the selected swipe. Several need a solo chat or **Individual** group generation. Route "the character keeps secrets / writes letters / rolls real dice" here before any custom agent.
- **Game Mode rulesets** (2.5.0). "Play D&D 5e / my homebrew system in Game Mode" → a **ruleset**: one JSON data file (dice resolution, sheet, resources, rests, items, combat, bestiary, Game Master text), chosen under **Rules** in the new-game wizard. Nothing in it executes and it adds no per-turn model calls. Only `dice-sum` and `dice-pool` resolution exist — other mechanics need an Engine PR. See `references/rulesets.md`.
- **Memory**:
  - **Memory Recall**, or **Advanced Memory Recall** (Roleplay; scene summaries and recalled excerpts; mutually exclusive with Memory Recall).
  - Chat summaries.
  - Up to ten **context-pinned** messages.
  - The **Long-Term Memory** and **Memory Nag** packages.

  See `references/agents.md` → the memory surfaces.
- **The official package catalog** (Agents → Download Agents) — **39** packages on the stable catalog at the v2.5.0 sync, grouped **Apps / Writer / Tracker / Misc**:
  - Trackers: Quartermaster (inventory/outfits), Relationship Tracker, World State, Quest Tracker.
  - Writers: continuity checking, card evolution, prose guarding.
  - Media: Illustrator, Calls.
  - Fun: the table games.
  - **Apps** that open their own Home tab and need a restart after install: Noodle and Slurp (social feeds), Gacha Forge.

  Fresh installs contain **no** optional agents, so include the install step (and the restart, for Apps). Professor Mari can compare packages and recommend one. **Custom GitHub agent repositories** (#3861) can distribute third-party packages and rulesets — disabled by default, manual preview/apply, explicit per-repo trust. Only recommend one the user already trusts.

**Fits:** "track my party's inventory," "map relationships between characters," "let characters whisper secrets," "real 5e combat with spell slots," "remember what happened twenty scenes ago."

**Doesn't fit:** genuinely bespoke per-turn logic no package or built-in covers → Q7.

---

### 7. Does something need to happen **automatically on every turn**?
Per-turn automation = not user-initiated, not tool-triggered — just runs in the background as part of message generation. Having ruled out built-ins and packages (Q6):

→ **Custom agent**, placed in the right phase:
- **`pre_generation`** — runs before the main response. Use for: injecting context, reviewing the prompt, rewriting directives, and (2.4.4) choosing which attached characters reply this turn.
- **`parallel`** — runs alongside the main response, from the pre-reply scene only (it can't see the reply). Use for: side tasks that don't block, such as reactions or lookups that don't depend on what the character says next.
- **`post_processing`** — runs after the main response. Use for: fact-checking, state extraction, rewriting for style, tracking variables, and media that should match the reply (the official Illustrator and Music DJ run here).

Since 2.4.4 a custom agent can also opt into **Create character cards** — proposing complete, editable cards that wait for the user's approval. That route covers "auto-create NPC cards as they appear."

Agents cost tokens and latency. Custom agents run in all three modes — but only while the chat's **Enable Agents** master toggle is on; if an agent "isn't firing," check that toggle first.

> **⚠️ Always specify context sources (2.4.0, #4305).** A custom agent receives **chat history only** by default. `characters`, `persona`, `activatedLorebookEntries`, `chatSummary`, `authorNotes`, `trackerData`, and `recalledMemories` are each **off** until enabled in that agent's **Context Sources**. (`recalledMemories` carries the built-in **Memory Recall** results — not the Long-Term Memory package vault — and also needs the agent's **Vectors/embeddings** capability, `access_vectors`; it is empty while Advanced Memory Recall is on.) So "a continuity checker" is incomplete advice — it needs `characters` + `activatedLorebookEntries` + `chatSummary` to do its job.
>
> Two later changes extend the rule:
> - In **Roleplay**, agent requests leave out chat summaries unless the chat's **Attach chat summaries** switch (Chat Settings → Agents) is on (2.4.6). This applies to built-in agents too.
> - Built-in agents can now pick their own context sources (2.5.0).
>
> If a user reports an agent that "stopped understanding the character," check both. Also note *(#4360)* that Run Interval counts **both user and assistant messages**.

**Fits:** A "tone enforcer" that rewrites every message to stay in-period for a historical RP; a "combat tracker" that extracts damage numbers from narration into structured HP (outside Game Mode — inside it, use a ruleset); a "continuity checker" that flags contradictions.

**Doesn't fit:** Things that only need to happen occasionally (those should be tools the model calls when needed).

**Before rejecting an agent on cost, gate it:**
- **Activation Keywords** (up to 100 phrases) with a **Scan Depth** (default 5, max 200) — the agent runs only when a keyword appears in that many recent messages. For post-processing agents, the keywords scan the finished reply (2.4.1). Empty keywords means run every turn — the default, and why unconfigured agents feel expensive.
- With a Decision model, an **Activation question** (2.5.0) — a statement of fact the model checks before the agent runs. Pair it with keywords or a trigger cadence, and use its **Bypass after N messages** safety valve.
- **Request batching:** compatible agents are batched into shared requests by default (long-standing). 2.5.0 added a per-agent **Share requests with other agents** switch to opt one out — turn it off for a local model that mixes up batched tasks.

Combined with a narrow `contextSources` set, an occasional-but-automatic job is perfectly viable as an agent. "Only sometimes" is not automatically a tool.

See `references/agents.md` for phases, capabilities, result types, and custom agent creation.

---

### 8. Does the UI itself need to change?

#### 8a. How it **looks**
Look-and-feel = colors, fonts, backgrounds, spacing, restyling existing elements — visual, not functional.

→ **Native Appearance settings first, then a custom theme.** Much theming is native — accent color, RGB/pulse, app background + gradients, chat text colors, font, colored character names in text (2.4.4), **chat widget styles** with presets (2.5.0), the Roleplay Classic / Visual Novel display (2.4.6), and "Reset Appearance." For styling beyond the native controls, use the server-synced **custom themes** system (`/api/themes`, managed under Settings → Addons). Professor Mari can also generate themes for you.

**Fits:** Custom color schemes, restyled chat bubbles, a themed look matching a character's world.

**Doesn't fit:** Functional UI additions — 8b.

#### 8b. Adding **functionality** (a button, panel, widget, indicator)

> **⚠️ Corrected guidance.** Client extensions were removed in v2.3.4, but **v2.3.5 reintroduced them as sandboxed Personal Extensions**, and v2.4.0 expanded the API. Earlier advice that "there is no user-side script path" is **obsolete**. There is one again — it's just narrow and permissioned.

- **A card on the Home dashboard** → ask Professor Mari for a **data-only custom Home widget** (2.4.2, #4801). Or have a custom agent publish bounded text to its Home widget during normal runs (2.5.0). Users arrange both in the **Widget Manager**.
- **A Personal Extension** (Settings > Addons) for anything more interactive.
  - **Authoring:** ask **Professor Mari** to draft it. Or the user hand-writes one following `docs/extending/writing-personal-extensions.md` (2.4.3) and imports it — hand-written code arrives as an External Extension behind both gates. Either way, the user reads the code, approves the exact SHA-256 hash, and enables it.
  - **What it can do:** it runs in a sandboxed Worker and can register buttons (on the top bar or on the Chats, Characters, Personas, Lorebooks, Presets, Connections, Agents, and Settings panels), Extensions-menu items, and right-side panels via `marinara.ui.registerContribution(...)`, built from a fixed control vocabulary (heading, text, pre, button, input, select, toggle, slider, color, spacer).

**Fits:** A per-chat notepad, a settings-style control panel for something the user tracks by hand, a small dashboard keyed to the active chat or character, a launcher for a multi-step workflow whose state lives in `marinara.storage`.

**Doesn't fit — and say so plainly:** anything needing messages, presets, lorebooks, undeclared card fields, chat metadata, DOM access, the database, or the network. The sandbox is a capability allowlist. Those need either a **new broker capability in the engine** (an upstream PR, Mode B) or the un-sandboxed **Full page access** External Extension path — which requires `ENABLE_EXTERNAL_EXTENSIONS=true` plus a Danger Zone opt-in, cannot be authored by Mari, and carries browser-console-level authority.

Note the read-only **context API**: chat and character IDs are always available (good for namespacing private storage), while bounded *card fields* require the approved `read_active_characters` / `read_active_persona` permissions. Check `references/extensions.md` for the current API version and permission list.

**Platform caveat:** Server Extensions need macOS Seatbelt or Linux `bwrap` and are **unavailable on Windows and Android** — check the OS before recommending one.

**Distribution:** for anything meant for other people, prefer a **downloadable capability package** (Capability API 1.66 at v2.5.0) via the Marinara-Agents catalog, or a **custom GitHub agent repository** (#3861). An exported extension lands in the recipient's gated External Extensions section and must be hash-approved there.

See `references/extensions.md` before committing to any extension design.

---

### 9. Does the solution need to cross chats, persist structured state, or integrate deeply with external systems?

> **Check Chat Variables first.** The engine *does* have in-engine, per-chat state, and since 2.5.0 it has a UI:
> - **Chat Settings → Chat Variables** — define `char1 = Mary`, and `{{char1}}` in a message reads as Mary to the AI.
> - The **`{{setvar::name::value}}` / `{{getvar::name}}`** macros (plus `addvar` / `addnumvar` / `incvar` / `decvar`; `addvar` appends text when a value isn't numeric) share the same store.
>
> Values persist across turns and restarts, are separate per chat, and roll back with swipes and deleted replies.
>
> Per-chat counters, flags, thresholds, and small structured values — an affection score, a day counter, whether the party has met the duke — belong here, not behind a backend. Recommending infrastructure for state a variable handles is over-engineering, and it was this guide's default answer for too long.

→ Once variables genuinely aren't enough: **Webhook tool + your own backend.** The engine's own persistence is scoped to chats, characters, personas, lorebooks, presets. If you need structured state outside that (CRM data, analytics, cross-user aggregation, ML pipelines, real databases) — you run that infrastructure yourself and expose it to the character via webhook tools.

**Fits (genuinely beyond variables):** "My support assistant needs to log every conversation to our CRM," "the character needs to remember things globally across all my users," "I want vector search across 10 years of company docs."

**Doesn't fit:** Anything inside the engine's native scope — use the native features. Small per-chat state is Chat Variables; per-chat UI state for a tool the user invokes is a Personal Extension's private `marinara.storage` (8b); remembering past scenes is a memory feature (Q6).

---

### 10. Does the character need to generate or animate images/video, or speak? (media routing)
Media generation = creating a picture or a short video clip — a scene illustration, an animated portrait, an in-call avatar, a storyboard keyframe — or a voice.

→ **Native media generation — the Illustrator package + an image or video connection, NOT a webhook.** Install **Illustrator** from Agents → Download Agents first: without it, the generation commands and the image/video generation settings stay hidden in every mode. Two ways to generate:
- **Automatic illustration** while chatting needs Illustrator **enabled for the chat**.
- **One-off illustrations** from Roleplay's **Gallery** or `/illustrate` work as soon as Illustrator is installed, with no need to enable automatic agents (2.5.0, #6874). `/illustrate [prompt]` draws just the requested subject (2.4.6).

Then add the connection and point the relevant surface at it. There is no need to build a custom tool for this.

**Image Appearance Override** (2.5.0) — if illustrations keep picking up outfit or scene detail from a card's Appearance, give the card or persona an image-ready description under Appearance → **Image Appearance Override**.

Current names: the Connections defaults category is **Images**; selfie configuration lives in **Illustrator Settings** under Chat Settings → Agents.

**Voice:** TTS goes through an **Audio** connection (2.4.3; ElevenLabs, OpenAI-compatible, PocketTTS, xAI Voice) with its own default under Connections → Defaults. Each character can have its own voice in the Character Editor's **Voice** section (2.5.0).

The video surface depends on where the video should appear:
- **Gallery "Animate"** — turn a generated image into a short clip.
- **Game Mode storyboards / scene videos** — animate GM narration keyframes.
- **Animated expressions** — expression portrait sprites rendered as short clips → looping GIFs.
- **Calls video presence** — cached avatar clips played in-call. Requires the downloadable **Calls** package; this surface doesn't exist unless Calls is installed.

**Fits:** "Can my character generate a video of the scene?", "I want an animated portrait", "make the avatar move during a call", "give each character their own voice."

**Doesn't fit:** Nothing here — do **not** route media requests to a webhook custom tool (Q4/Q5). See `references/architecture.md` and `references/character-cards.md` for the connection setup and surfaces.

---

### 11. Does the user just need to rewrite or clean up prompt or output *text*? (Regex Scripts)

Text transform = find/replace on the strings flowing through the pipeline — strip a leftover prefix, swap a name on the way in or out, hide a control token, tidy formatting. **No** callable capability, **no** DOM change — just string rewriting.

→ **Regex Scripts** (SillyTavern-style): a regex `find` + `replace` applied to prompt and/or model output. SillyTavern regex scripts import over directly. This is a distinct modding surface — don't misuse a custom tool (Q5) or a theme (Q8a) for text transforms.

**Scoping:**
- **Per character** (Specific Characters).
- **Per prompt preset** (Specific Prompt Presets, 2.4.1).
- **Preset Regex tab** (2.4.6) — prompt presets carry their own scoped-regex defaults, which chats inherit unless they override them.

> **Two settings decide whether the script does anything at all — name both.**
> - **Apply Mode** (Advanced Options) defaults to **Only Display**, which changes on-screen text only and leaves the prompt untouched. To change what the *model* reads, it must be **Only Prompt** or **Both**. For a **User Input** script, Only Display/Both rewrite the message *before it is sent*, changing what is saved and transmitted — there is no display-only mode for outgoing user messages.
> - **Scoped Regex Scripts** (Chat Settings) decides whether character-scoped scripts run **on screen**: Disabled / Exclusive / Chat. A chat with no override inherits its preset's default (2.4.6). Prompt-side scoped scripts always follow the character actually generating the reply. "I wrote a character regex and nothing changed on screen" is usually this setting.
>
> See `references/custom-tools.md` for the full field set.

**Fits:** "Strip the `<think>` block from replies," "always rewrite 'the assistant' to the character's name," "clean up markdown the model over-formats."

**Doesn't fit:** Anything that needs to *call out* or *compute* (that's a tool) or restyle the UI (that's a theme, Q8a).

See `references/custom-tools.md` → Regex Scripts and `docs/extending/regex-scripts.md`.

---

## Common Combinations (Stacks that Work)

Most real projects are two or three of these surfaces together. Don't recommend just one when a combination is cleaner.

### "Documentation character" (like Professor Mari)
**Character card** (personality + framing) + **system prompt with reference material** (if it fits) or **lorebook** (if it doesn't). No tools needed unless the character should do things to the user's environment.

### "Live-data assistant"
**Character card** (voice, framing, what not to do) + **webhook custom tool** (the live source) + optional **lorebook** (stable background context).

### "Character that manages your app"
**Character card** + **multiple custom tools** (one per action the character can take) + optional **custom agent** to nudge the character to use the tools naturally.

### "Immersive RP character"
- **Character card** + **lorebook** (world info, with reference images for key places and outfits).
- **Roleplay Commands** for secrets, notes, and dice.
- **Advanced Memory Recall** for long campaigns.
- Official tracker packages (**Relationship Tracker**, **Quartermaster**) before custom state-tracking agents.
- Optional **parallel agent** (image generation, music).
- The native **Tracker Panel** for the HUD (optional radial-gauge layout since 2.4.0).

### "Tabletop campaign in Game Mode"
- A **Game Mode ruleset** (an official one or the user's own JSON) chosen under **Rules** in the new-game wizard.
- **Combat Preference** for narrative vs. tactical fights.
- A **lorebook** for the world.
- Optionally the **Quartermaster** and **World Maps** packages.

Don't stack dice script tools and tracker agents to imitate a system a ruleset can describe.

### "Knowledge base over a large structured dataset" (300 WordPress sites, customer records, etc.)
**Character card** (teaches the model how to look things up) + **webhook custom tool** (`lookup_by_id`, `search_by_field`, `list_all`) + **your own backend** (the actual data store). Do NOT try to put the dataset itself in the lorebook unless it's small and the lookup pattern is keyword-shaped.

---

## Red Flags That Signal "This Is Wrong"

Push back when you hear these:

- **"I'll put 10,000 entries in the system prompt"** — Every turn re-sends the full prompt. Impossible past context limits, wasteful before that.
- **"I'll use a script tool to hit my API"** — Script sandbox has no network. Use webhook.
- **"I want it to *always* know the current date"** — The engine already injects date/time into the conversation system prompt each turn. No tool needed.
- **"I'll make a custom agent to call my API every turn"** — Technically works but wastes tokens. Prefer a tool the model calls when needed.
- **"I want the character to edit their own card"** — Possible via API call in a tool, but architecturally weird; usually a sign the state should be elsewhere (lorebook, Chat Variables, external DB).
- **"I'll have three separate agents do the same job"** — Agents don't combine; their outputs are independent injections (even when batched into one shared request). Pick one.
- **"I'll hardcode all the user data into the character"** — Use personas (the engine's user-identity feature) for that. And pick the persona per chat — there's no global default persona anymore (2.4.6).
- **"I'll run per-turn agents and dice tools to emulate a TTRPG in Game Mode"** — Use a ruleset (Q6).
- **"The content warning only shows when the Decision model says the scene is dark"** — Never gate safety on a decision; with no answer it reads as *no* (Q3).
- **"Set the lorebook entry's probability to 0.5"** — That's a 0.5% chance. Probability is 0–100.

---

## Questions to Ask the User (When Unclear)

Ask AT MOST ONE before drafting options. Don't block.

1. **"Is the knowledge stable, or does it change?"** — Gates lorebook vs. webhook tool.
2. **"Do you want the character to *do* things, or just answer?"** — Gates tool-calling vs. pure conversation.
3. **"Are you running this on a frontier model (Claude, GPT-5, Gemini) or something smaller/local?"** — Affects how much you can offload to the model's native knowledge. It also gates two things:
   - **Tool use:** on the local llama.cpp sidecar, native (OpenAI-compatible) tool calling only works when it's launched with `--jinja` (the native-tool-calls runtime toggle). Setups that emit tool calls as plain `<tool_call>…</tool_call>` text (some KoboldCPP / Gemma configurations) are recognized and run; since 2.5.0 (#6951) that raw text also stays out of streamed replies.
   - **Decision features (Q3):** these need a Decision model on top of the chat model.
4. **"Is this a one-off or something you'll maintain long-term?"** — Affects whether to optimize for build speed (card + prompt) or maintainability (lorebook + tools).
5. **"Do you already have this data somewhere (Google Sheet, DB, API)?"** — Unlocks the webhook path.
6. **"Is this for you alone, or will others use it?"** — Affects how much UX polish matters (themes, tool confirmation flows) and which distribution lane fits (package, custom repository, exported extension, shared ruleset).

Don't ask all six. Pick the one that actually gates the recommendation.
