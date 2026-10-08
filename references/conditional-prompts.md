# Conditional Prompts & Decision Models

Two connected surfaces. **Conditional blocks** (`{{#if}}`) are part of the macro engine: deterministic, free, and they work wherever macros resolve. **Decision models** (new in **v2.5.0**) are an optional helper that answers yes/no or pick-one questions about the recent chat. A conditional block can ask one (`decision:` / `decision_choice:`), and the same model also drives lorebook **Decision** fields, custom-agent **Activation questions**, **Smart response order** and, optionally, **Advanced Memory Recall**.

**Engine docs (the long versions):** `docs/prompts/conditional-prompts.md`, `docs/connections/decision-models.md`, `docs/lorebooks/entries.md#decision-activation`, `docs/agents/custom-agents.md#activation-questions`, `docs/chats/group-chats.md`, `docs/agents/memory.md#optional-decision-model`, `docs/chats/peek-prompt.md#testing-decision-statements`. **Code:** parsing and evaluation in `packages/shared/src/utils/macro-engine.ts`; limits and defaults in `packages/shared/src/types/decision.ts`; planning and backends in `packages/server/src/services/decision/`. Code wins where it and the docs disagree.

## Conditional blocks (`{{#if}}`)

**Where they work:** everywhere macros resolve. That includes presets (and preset variable options), character cards, personas, lorebook entry content, author's notes and custom-agent **Prompt Templates**. Since **v2.4.4 (#5423)**, agent requests keep the chosen text and strip the control syntax and encoded quote entities.

```
{{#if length == "short"}}One or two sentences.{{else if length == "long"}}Several paragraphs.{{else}}Normal length.{{/if}}
```

The first true branch wins. If no branch matches and there's no `{{else}}`, the block resolves to nothing. Blocks can be one line or several, and they nest.

| Operator | Meaning |
|---|---|
| `==`, `=`, `is` | Equal. Compared as numbers if both sides parse as numbers (`5` = `5.0`), otherwise as text, ignoring case (`Mari` = `mari`) |
| `!=`, `is not` | Not equal (same rules) |
| `>`, `<`, `>=`, `<=` | Numbers only. If either side isn't a number, the condition is **false** |
| `contains`, `includes` / `not contains`, `not includes` | Case-insensitive substring match / its negation |
| *(no operator)* | Truthy check: true if the value is non-empty and isn't `false`, `0`, `no`, `off`, `null` or `undefined` (any case). Use it to include a field only when it's filled in |

- **`&&` binds tighter than `||`.** Use parentheses to change the order. **Equality-list shorthand:** `char == "Maukie" || "Pantalone"` works only after `==` / `=` / `is`. Write complete conditions on both sides of `&&`.
- **↺** The skill used to list only `||`, `&&`, parentheses and the shorthand. The negated operators were always supported, and since **v2.4.4 (#5383)** the in-field Macro reference and `/macro` help show them.
- **There is no negation prefix** (`!x`, `not x`) and no `{{#unless}}`. A condition written that way is read as plain text, not inverted (`parseConditionExpression`). To negate, use `!=`, `is not` or `not contains`, or put the text in `{{else}}`.
- **What you can test:**
  - Identity and field keywords: `char`, `user`, `group`, `persona`, `description`, `personality`, `scenario`, `backstory`, `input`, `model`, …
  - Quoted literals, and preset variable names.
  - `var:name` / `var.name`, which reads preset variables first, then the chat's `{{setvar}}` variables.
  - Any *read* macro written bare (`lastGenerationType`, `agent::TYPE`, `date`, …). Write macros never run as operands.
  - Decision operands (below).
- **Quote your literals.** An unquoted unknown word is tried as a variable name and otherwise used as its own text. An unquoted multi-word value (`Dr Smith`) becomes one variable name. Straight or typographic quotes both work; `\"` and `\n` are escapes.
- **Group blocks:** put `[` on its own line, then text containing a character macro or a character-based condition, then `]` on its own line. In a chat with 2+ characters the text repeats once per character. In a solo chat the brackets stay as literal text.

## Decision models (v2.5.0)

**What it is.** A helper that never writes into the chat. It's given a **statement** and the recent messages. It returns how likely the statement is to be true (0–1), and Marinara compares that with a threshold to get yes or no. It can also pick one option from a short list, or "none of these". **Jev** is TypeSafe's hosted model (direct or through OpenRouter). **Open-Jev** is a separately published Qwen-based model that Marinara can run locally. Write shared content for "a Decision model", never "requires Jev". The UI now says **Decision model** everywhere it used to say "Jev" (#6983).

**Choosing one:** **Connections → Connection defaults → Decision model**.
- The default is **None (decisions off)**. Switching back to None turns decisions off without deleting any questions or statements.
- The list has two groups: **Local models** (Primary local model, Utility local model, and the Decision sidecar if installed) and **Connections** (your Decision connections).
- Entries that can't answer right now stay in the list, greyed out with the reason. Picking an unusable model leaves your previous choice in place.
- **Test** sends a fixed sample. It checks the connection, not your statement.

| Option | Cost | Key facts |
|---|---|---|
| **A local model you already run** (Primary or Utility slot) | Nothing extra; nothing leaves the machine | **Try this first.** It's asked for one yes/no token, read from log-probabilities; a runtime without log-probs answers a flat 1 or 0. A `decision_choice:` becomes one yes/no question per option. **Thinking** setting: **Auto** (default; lets the model reason after 2 failed one-word answers), **Off**, **Allowed**. A model that has to reason only answers gates that run after the reply, unless you turn on **Also gate agents that run before the reply** (then every reply waits for it). |
| **OpenAI-compatible chat model** connection (Ollama, LM Studio, llama.cpp) (#6714) | Nothing extra | Click **Use this model for decisions** on a Custom connection to create it, so the model isn't loaded twice. Statements are sent one at a time. **Thinking** is always Auto. |
| **Hosted Decision connection** (provider **Decision**) | Billed; one turn can make several requests | Sources: **TypeSafe**; **OpenRouter** (**Use this key for decisions** links a saved OpenRouter key); **Custom System One endpoint** (Open-Jev or Strands decider that you run; base URL without `/v1/systemone`). A TypeSafe connection can point its **Base URL** at another server running TypeSafe's API, and your key goes to that server (#7084/#7134). **Recent-message token budget**: 30,000 hosted / 3,500 custom. **The practical choice on a phone (Termux).** |
| **Decision sidecar (experimental)** | Open-Jev 2B ≈10 GB disk / 4.8 GB VRAM; 9B ≈25.3 GB / 23.6 GB | **Connections → Local Model → Decision sidecar (experimental) → Enable decision sidecar**, pick a model, then select **Decision sidecar** under Decision model. Needs Linux x86-64, an NVIDIA GPU with compute capability 7.5+ (RTX 20 series or newer) and driver 580+. No Android, ARM or Pascal. Survives a runtime reinstall (#6982). You can paste a HuggingFace repo, which installs only if its manifest names a runtime this build ships. |

A server elsewhere on your LAN needs `PROVIDER_LOCAL_URLS_ENABLED` (on by default on Android).

**Thresholds.** Probabilities aren't comparable across models.
- **Defaults:** **0.5** for local chat models, OpenAI-compatible connections and TypeSafe / OpenRouter / Custom System One. The managed sidecar uses its manifest's value (**0.1** for the built-in Open-Jev 2B/9B).
- **Self-hosted Open-Jev trap:** behind Custom System One it still gets 0.5, so true positives can read as no.
- **Only an agent's threshold can be changed.** **Run when probability is at least** (0.05–0.95) is the only override. Prompt statements and lorebook fields always use the backend default.
- **Prompt conditions never see the raw score**, only yes/no or the chosen option. So `decision:"…" > 0.7` doesn't work.

**Time limits** apply per statement, never per group (#6721). A late answer counts as no answer.

| Backend | Limit per statement |
|---|---|
| Decision connection | **Time limit (seconds)**, 0.5–30; default 1.5, or 4 for OpenAI-compatible (#6580) |
| Local model | 4 s |
| Model that has to reason first | 20 s |
| Sidecar | 4 s for the first statement, then 0.35 s each (2B) / 0.8 s each (9B) |

Hosted answers sometimes take longer than 1.5 s, which makes decisions look "randomly broken". Click **Test** a few times and set the limit above the slowest answer. Statements asked before the reply can each hold the reply up to the limit.

### What the model reads, and what it never sees

- **It reads only** the statement plus recent saved messages, each labelled with the speaker's name. Messages hidden from the AI are left out. Macros in the statement are filled in first, so `{{char}}` arrives as a name.
- **How many messages:**
  - Prompt statements, lorebook statements and Smart order read the **last 5 messages (fixed)**.
  - Activation questions read the agent's **Scan Depth** (default 5, max 200).
  - Checks made after the reply also see the new reply.
- **It never sees** the preset, character cards, persona, lorebook entries (Constant ones included), summaries, agent output, or anything inserted **@ Depth**. **A statement that depends on a card or lore fact must state that fact itself.**

### Fallback when there's no model, no answer, a timeout or an error

| Consumer | Falls back to |
|---|---|
| `decision:` in a prompt | False: the `{{else}}` branch, or nothing |
| `decision_choice:` | Every comparison is false, **even `!=`** (`evaluateParsedCondition` checks for this explicitly) |
| Lorebook **Require** | Can't admit a new entry (an existing Sticky hold can keep one active) |
| Lorebook **Trigger** | Adds no route; keywords, Constant, semantic and map routes still work |
| Agent **Activation question** | Doesn't block: the agent runs whenever its keywords and **Trigger Cadence** allow |
| **Smart response order** | Its usual Smart AI call |
| **Advanced Memory** | Ordinary recall, or the existing scene checker |

**Warnings when no model is set:**
- A note appears under any field that uses decisions.
- Imports that use decisions (including custom agents and Agent catalog installs) show a notice explaining the fallback and linking to the guide (#6605). Whole-profile ZIP restores don't show it.
- Peek Prompt counts the statements that read as no.

## Decision statements in prompts

```
{{#if decision:"The latest message moves the scene to a new place"}}Open with one or two sentences on the new location.{{/if}}
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}Short, clipped lines.{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}Quiet; looks away.{{else}}His usual self.{{/if}}
```

- **Where they work:** presets, cards, personas, lorebook entry content and agent Prompt Templates, including Marinara-Agents packages (v2.5.0, #6569). They combine with everything above: `&&`, `||`, parentheses, nesting and group blocks.
- **Character names:**
  - In a group block, a statement that names `{{char}}` is asked once per character.
  - **In an agent prompt, `{{char}}` names every chat character at once** ("Kaelen, Alyssa is angry"). Write the character's name, or "a character".
- **`decision_choice:` options:**
  - The options are every value the statement is compared with anywhere in the prompt, plus "none of these". The shorthand `== "rain" || "snow"` works.
  - Only `==` / `=` / `is` / `!=` / `is not` name an option.
  - Write the statement as a subject and the options as short answers.
  - Servers that need a description for every option (Strands decider) refused choices before v2.5.0 (#6981).
- **Answer reuse:** answered once per turn.
  - Regenerations and swipes reuse the server's in-memory answer cache (200 turn keys). A restart, an edited latest message, or a changed model, statement or option set means the question is asked again. Failed answers aren't cached.
  - Pre-generation and parallel agents share the main prompt's answers. Post-processing agents ask again, once per reply, against the finished reply.
- **Inside a lorebook entry's content,** a statement only trims the text of an entry that already activated. The entry still uses its token budget and starts its timers. To decide whether the entry activates at all, use its **Decision** field.

**Modifiers.** They go after the closing quote, in any order, and combine: `decision:"…" priority:high sticky:3 cooldown:5 every:2`.

| Modifier | Effect |
|---|---|
| `sticky:N` | After a yes, stays yes for N more turns without being asked (#6582) |
| `cooldown:N` | Starts when sticky ends (or right after the yes). Reads as no for N turns, not asked |
| `every:N` | Asked on the first turn it's reached, then every N turns. Reads as no in between (#6599) |
| `priority:high` / `priority:low` | Asked first / dropped first when a turn is over the limit. No priority = medium (#6599) |
| `until:"…"` | After a yes the block stays on and the first statement isn't asked. The until statement is asked each turn instead; the block turns off when it's true (#6922) |
| `while:"…"` | Stays on while the second statement is true; turns off on the turn it's false |

How the modifiers behave:
- **Turns:** a turn is a new message the model reads. Regenerations and swipes don't advance timers. A held statement uses no slot. Peek Prompt shows held answers and never advances a timer.
- **Same statement in several places:** it uses the longest sticky and cooldown, the smallest `every:` and the highest priority.
- **With `decision_choice:`:** sticky keeps the chosen option; cooldown reads every comparison as no. A choice of "none" starts nothing.
- **`until:` / `while:` rules:**
  - They work with `decision:` only.
  - Write only one of them; if you write both, only the first counts.
  - If the second statement gets no answer, the block **stays on**. While the block is on, the second statement uses a slot.
  - Cooldown starts once the block turns off.
- **Combining with sticky:** add `:and` / `:restrict` (off at whichever ends first) or `:or` / `:extend` (whichever ends last). The defaults are `until` → `:and` and `while` → `:or`. Without sticky these make no difference.
- **Silent failures (from code):** N must be a positive integer and is capped at 1000. **Unknown or misspelled modifiers are silently ignored**, so a typo means no timing, not an error.

**Decision statements per turn** (set under Decision model): default **32**, range 1–**255**.
- **What it limits:** how many prompt and lorebook statements are planned. It is not a cap on requests or spending.
- **How it's applied, in stages:**
  1. The main prompt's statements are planned first (preset, cards, persona, author's notes).
  2. The lorebook uses whatever is left.
  3. Pre-generation and parallel agents get one combined plan that uses the full allowance again, so the total can exceed the setting.
  4. Post-processing agents get a separate allowance.
- **Not counted:** activation questions and Smart response order.
- **Only reachable statements are counted** (#6582): enabled preset sections, selected variable options, entries that activated, and blocks not already ruled out by a fixed condition. For example, `char == "Dottore" && decision:"…"` isn't asked while the character is Mira.
- **Over the limit:** statements read as no, and Peek Prompt lists them.

**Testing:** **Peek Prompt → Decision diagnostics** (#6650).
- **Preview inputs** is passive: it sends nothing.
- **Test decisions** makes real requests, which can be billed. It doesn't generate a reply, run agents, or save answers or timers.
- For live turns, use Debug Mode or the debug log level, which logs each statement's score, threshold and outcome.
- **If a branch never appears, check in this order:**
  1. No Decision model is set.
  2. The model isn't answering (bad key, no credits, rate limit, stopped, too slow, sidecar not started).
  3. It's a reasoning model holding off before the reply.
  4. The turn is over the allowance.
  5. It answers, but below the threshold (usually the wording).

## The other Decision consumers (short; follow the pointers)

- **Lorebook entry Decision field** (#6570), stored as `decisionMode` `off` / `require` / `trigger` plus a `decisionStatement` of up to 500 characters.
  - **Require:** the entry activates the usual way *and* the statement must be true. This filters out passing mentions, and makes a Constant entry situational.
  - **Trigger:** the statement can activate the entry without its keywords.
  - The field is a plain statement: no `decision:` prefix and no modifiers. Use the entry's own **Sticky** / **Cooldown**, which also skip asking.
  - Game setup, experience generation and agents' own lorebook scans read these entries as no. The active-lorebook list shows **decision** for an entry a Trigger activated.
  - → `lorebooks.md`.
- **Custom-agent Activation question** (#6530).
  - Settings: `activationQuestion` (≤500 characters, macros allowed), `activationThreshold` (0.05–0.95), and `activationMaxSkip` (1–100). In the UI the last one is **Bypass the question after this many messages without a successful run**; set it for any agent that matters.
  - Keywords and cadence are checked first, so a skipped agent costs no request.
  - The fields stay disabled while Decision model is None.
  - → `agents.md`.
- **Smart response order** (#6559): group chats, Individual mode. Turn on **Also use it to pick who speaks in Smart response order** (off by default).
  - It asks one yes/no question per candidate. Each question gets the last 5 messages plus a roster (name, status, activity, talkativeness, and up to 300 characters of personality or description), and a hosted provider receives that roster too.
  - Roleplay picks the most likely speaker. Conversation lets everyone with a reason reply, most likely first.
  - Roleplay's response picker also gains a **Smart** option.
- **Advanced Memory Recall** (Roleplay; out of Alpha in v2.5.0, #6749; mutually exclusive with basic Memory Recall, #7150).
  - **Use Decision model** plus a per-chat **Memory Decision connection**, separate from the global default. It detects scene endings and picks recaps and excerpts.
  - The Helper model still writes the summaries. Recall falls back after 10 s in total.
  - Its results show under Decision diagnostics → **Advanced Memory activity**.
  - Its recaps use `{{#if character == "Name"}}` for private POV sections.
  - → `agents.md`.
- **Professor Mari** (#6629) can author all of the above. She checks the live Decision status first. With no model selected she adds no Decision content unless you explicitly ask, and then she explains the fallback and asks once per chat. She prefers keywords or deterministic conditions, adds a timing control, and places changing blocks late (`services/professor-mari/decision-authoring.ts`).

## Writing statements

- **Write a fact that's either true or false, not a question or an instruction.** "Did the scene change?" scored worse. "If the scene changed, describe it" got a no every time from a local model, so the block never ran. This applies to the Activation "question" field too.
- **Say "in the latest message"** when you mean this turn. Otherwise an earlier message can make it true.
- **Name who it's about.** "He is angry" was read as the wrong character.
- **Describe something visible in the text** (an action, something said), not a mood word ("the scene is intense") or a hidden intent ("Mira is lying").
- **Include the facts the model can't see.** "The sister arrives" means nothing without the card. Write "Mira, Kaelen's sister, arrives in the latest message".
- **Keep it short.** A plain "and" or a negation is fine. Splitting a compound statement makes it easier to reuse and debug.
- Test representative turns where the statement should be true and where it should be false, in Peek Prompt. Model accuracy differs (in the docs' small test a Gemma 4 E4B local model scored 32/32, Open-Jev 2B and 9B 31/32), so don't generalize from one model.

## Routing and safety

- **Use decisions to fine-tune, never for anything the chat can't do without.** A missed decision should make a reply slightly less tailored, not break it.
  - **Never gate consent, content warnings or safety instructions on a decision.** Keep them always present.
  - Give every block a sensible default: nothing, or an `{{else}}` that's fine on any turn.
  - Don't chain decisions so that one wrong answer flips several others.
- **Use something deterministic first.**
  - Exact terms → lorebook keywords, agent Activation Keywords, or `input contains "…"`.
  - Who is speaking → `char == "…"`.
  - Tracked state → variables.
  - Use a decision only when a paraphrase or a situation matters ("a fight starts", "the scene moves"). Keywords cost no model call and add no latency.
- **Pair every Trigger entry and every activation-question agent with an ordinary keyword or cadence route**, because many users have no Decision model. Give such agents a **Trigger Cadence** so they don't run every turn without one.
- **Cost and latency.**
  - Hosted backends are billed, and one turn can make several batched requests (lorebook rounds, agent phases, Smart order).
  - Local backends cost time instead.
  - Statements asked before the reply delay it.
  - Use `sticky`, `cooldown` and `every` to cut repeat checks. `every:` can miss events that come and go quickly.
- **Prompt caching:** put changing decision blocks **late** (post-history instructions or a shallow author's note). An early branch flip can lose most of the provider's prompt-cache savings. The same applies to preset variable options.
