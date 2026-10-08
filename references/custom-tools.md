# Custom Tools

Custom tools are the primary modding surface for **giving a character real capabilities**. They expose user-defined functions to the main chat model as OpenAI-compatible function definitions. When the model decides to call a tool, the server executes it and feeds the result back into the conversation.

**Source of truth:** `packages/server/src/services/tools/tool-executor.ts` (+ `custom-tool-script.worker.ts`) and `packages/shared/src/schemas/custom-tool.schema.ts`. User guide: `docs/extending/custom-tools.md`.

## Schema

```typescript
{
  name: string,           // lowercase snake_case, 1-100 chars, [a-z][a-z0-9_]*
  description: string,    // 1-500 chars, shown to the model as the function description
  parametersSchema: object,  // JSON Schema for function parameters (default: {})
  executionType: "static" | "webhook" | "script",  // default: "static"
  webhookUrl: string | null,      // required if executionType is "webhook"
  staticResult: string | null,    // required if executionType is "static"
  scriptBody: string | null,      // required if executionType is "script"
  includeHiddenContext: boolean,  // default: false; when true, Marinara passes a `context` object (current-turn runtime context) to the webhook body / script sandbox
  enabled: boolean,       // default: true
  sortOrder?: number,     // drag order in the Functions list — display only
}
```

When the tool is enabled and the chat is configured to allow tools, the tool is added to the OpenAI-format `tools` array sent to the LLM. The model decides whether and when to call it. Multiple tools can be called in a single turn; the executor runs them sequentially.

**Local models:** *native* (OpenAI-compatible) tool calling on the local llama.cpp sidecar needs it launched with `--jinja` — the runtime's native-tool-calls toggle (`enableNativeToolCalls`). It isn't the only route (earlier guidance here said tools never fire without it — too strong): on OpenAI-compatible connections, a reply with no native `tool_calls` that writes `<tool_call>{"name": …, "arguments": …}</tool_call>` as text (some KoboldCPP and Gemma setups do) is parsed and run, and a connection with **Treat as local/custom endpoint** on also gets an `<available_functions>` block in its system prompt teaching that format. **(v2.5.0, #6951)** With streaming on, that raw `<tool_call>` text no longer leads the reply on screen and isn't saved. Frontier provider models call tools natively; **Claude and Grok subscription** connections ignore tool definitions entirely (Chat Settings shows a notice and disables the tool controls).

**Provider notes:** each tool call costs one more request. **(v2.4.6, #5904/#5918)** Gemini and Anthropic replies stream normally on tool-using turns (the panel's note excepts Gemini with thinking on). **(v2.4.4, #5430)** OpenAI-compatible custom connections keep Anthropic-style `tool_use` blocks, so proxies like LinkAPI Opus show tool calls again.

**Connection Custom Parameters (v2.3):** saved Custom Parameters on a Connection apply to **every** API-backed text generation on that connection — including Noodle and locally hosted custom endpoints — while per-chat/per-call overrides still take precedence. Arbitrary JSON and bare string parameter values are preserved as-is, and unified reasoning-effort requests work again for discovered OpenRouter models (#3688). **(v2.3.4, #3845)** Enabled Connection generation defaults now apply across **every Noodle text-generation path**, and custom OpenAI-compatible endpoints accept explicitly enabled **top-k**, **reasoning-effort**, and **verbosity** parameters. **(v2.5.0, #7131)** Agents now use the connection's **Use custom defaults for this connection** settings too (Top P/K, Frequency, Presence, Reasoning Effort, Verbosity, OpenRouter Service Tier, Custom Parameters and headers; a parameter with a Send switch is sent only while it's on) — including retries, knowledge agents, the Illustrator's prompt writer and installed packages. Custom defaults start Reasoning Effort at **Maximum**, which now replaces the "off" JSON agents asked for — turning custom defaults on can make every agent reason at Maximum (cost). **(v2.4.4, #5351)** On **Claude Subscription** connections, custom parameters may override model-generation settings only; tool, process, environment, filesystem and session controls stay provider-owned.

## Execution Types

### `static` — Hardcoded response
Returns a fixed string. Useful for:
- Stubbing tools during development.
- Teaching the model that a tool exists before the backend is built.
- Returning a constant value (rare in practice).

**Behavior:** Returns `{ result: tool.staticResult ?? "OK", tool: tool.name, args }`.

**When to use:** Scaffolding only. Replace with webhook or script before shipping.

### `webhook` — HTTP POST to a URL
The server POSTs `{ tool: <name>, arguments: <args> }` to `webhookUrl` as JSON, with the configurable custom-tool timeout (**60s by default**, override via `CUSTOM_TOOL_TIMEOUT_MS`). Response body is parsed as JSON if possible, otherwise returned as `{ result: <text> }`, and is capped at **512KB**.

**Related env vars (v2.3):** don't confuse `CUSTOM_TOOL_TIMEOUT_MS` with two knobs added in 2.3.3 (#3730): `CHAT_GENERATION_TIMEOUT_MS` raises the chat-generation timeout for slow Conversation/Roleplay/Game providers, and `AUTO_UPDATE_ENABLED=false` is a persistent launcher auto-update opt-out (Windows/macOS/Linux/Termux) that doesn't disable manual updates.

**The URL must be HTTPS, and local/private targets are blocked by default.** The request goes through an SSRF-hardened `safeFetch`: only `https:` is allowed, and loopback/private/reserved hosts (`localhost`, `127.0.0.1`, `192.168.x.x`, etc.) are rejected unless the server sets `WEBHOOK_LOCAL_URLS_ENABLED=true`. So a `http://localhost:3100` dev backend won't work out of the box — expose it over HTTPS (e.g. a tunnel) or set `WEBHOOK_LOCAL_URLS_ENABLED=true` for local testing.

**Home Assistant integration:** Marinara has a first-class Home Assistant integration that **auto-generates webhook custom tools from your HA entities** — you don't hand-write them. Re-syncing updates the already-generated tools in place rather than duplicating them. Because Home Assistant is reached over the local network as plain HTTP, these generated tools hit the exact SSRF gate above, so the integration **requires `WEBHOOK_LOCAL_URLS_ENABLED=true`** (same knob as the localhost note). Source of truth: `docs/integrations/home-assistant.md`. (The integration landed in an intermediate 2.0.x update; the 2.1 doc refresh corrected its docs/defaults — the current port, the `WEBHOOK_LOCAL_URLS_ENABLED=true` requirement, and the re-sync-updates-existing behavior.)

**This is the primary integration point for real work.** Use it to connect the character to:
- Your own backend (Express, Fastify, Cloudflare Worker, Lambda, anything that speaks HTTP).
- n8n, Zapier, Make, or any workflow automation tool.
- A lightweight Python/FastAPI service you wrote for the specific integration.
- A Google Apps Script web app.
- A Discord webhook (limited — one-way notification only, won't return useful data to the model).

**What to implement on your end:**
1. Accept `POST` with JSON body `{ tool: string, arguments: object }` (plus an optional `context` object when the tool has `includeHiddenContext: true`).
2. Validate and process.
3. Return JSON. Keep it concise — whatever you return goes into the model's context.

**Error handling:** a timeout or network error becomes `{ error: "Webhook call failed: <msg>" }`; a non-2xx reply still reaches the model with its parsed body, flagged as failed. Any result carrying a string `error` key counts as a failed call. The model sees the error and can react — often retrying or apologizing to the user. **(v2.4.6)** Failed and denied tool calls also show the user a short notification even with debug mode off.

**Stored URLs (v2.4.2):** webhook URLs are encrypted at rest (same scheme as connection API keys), but the editor shows them in full and **Export function** writes them out in plain text.

**When to use:** Any tool that needs to reach outside the engine. **This is the default recommendation for real functionality.**

### `script` — Sandboxed server-side JavaScript
**Disabled by default.** Script tools need `CUSTOM_TOOL_SCRIPT_ENABLED=true` in the server's `.env` and a restart. With it off, the editor greys out the **Script** card, existing Script tools show an amber **Script disabled** pill and are not offered to the model, saving a Script tool is refused (HTTP 403), and a direct call returns `{ error: "Script custom tools are disabled. Set CUSTOM_TOOL_SCRIPT_ENABLED=true to enable trusted isolated script tools." }`. Tell the user to set that env var before recommending a script tool.

**How it runs (changed in v2.4.2 — earlier guidance said Node's `vm.runInNewContext`):** each call starts a terminable `node:worker_threads` Worker that evaluates the body in a **QuickJS** interpreter (`quickjs-emscripten`), capped at **32 MiB memory** and a **2 MiB stack**, with a deadline interrupt plus a hard `worker.terminate()` at the shared custom-tool timeout (**60s by default**, `CUSTOM_TOOL_TIMEOUT_MS`). The wrapper is `"use strict"; … JSON.stringify((function() { <scriptBody> }).call(undefined))`, so **the return value is JSON-serialized** — return plain JSON-able data; returning nothing yields `{ result: "OK" }`. A thrown error comes back as `{ error: "Script error: <msg>" }`.

**Inside the sandbox:**
- `args` — the tool arguments (a JSON copy)
- `context` — the current-turn runtime context, or `null` (only populated when the tool has `includeHiddenContext: true`)
- `console.log` — a no-op
- Standard ECMAScript built-ins only — `JSON`, `Math`, `Date`, `String`/`Number`/`Array`/`Object`, `RegExp`, `Map`/`Set`, `parseInt`/`parseFloat`, etc.

**Not available:** `fetch` or any network, `require`/`import`, `process`, `Buffer`, filesystem, environment variables or server secrets, timers (`setTimeout`/`setInterval`), or anything else from Node or the browser. The body runs **synchronously** — `await` is a syntax error and a returned Promise serializes to `{}`. The engine doc's own caveat: this blocks network and file access but **is not full operating-system isolation** — a script can still burn CPU and memory up to its caps, so only enable scripts on servers you trust.

**What scripts are actually good for:**
- Date math (parse a date, add days, format output).
- String manipulation (CSV splitting, regex extraction, case conversion, validation).
- Dice rolling, random generation.
- Unit conversions.
- Computing derived values from inputs.
- Sanitizing or validating user-supplied data before the model acts on it.

**What scripts CANNOT do:**
- Fetch anything from the web.
- Read files.
- Call APIs.
- Persist state across invocations.
- Call other tools.

**When to use:** Pure computation only. If the tool needs I/O of any kind, use webhook instead.

## Parameters Schema

`parametersSchema` is a JSON Schema object defining the function's parameters. Follows the standard OpenAI function-calling format:

```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "The search query"
    },
    "limit": {
      "type": "integer",
      "description": "Max results",
      "default": 10
    }
  },
  "required": ["query"]
}
```

The model sees the schema and uses it to generate well-formed arguments. **Describe each parameter clearly** — the `description` field is read by the model and strongly influences call quality.

## Built-In Tools (Not Custom, but Same Protocol)

Marinara ships built-in tools that work the same way (the executor switch in `tool-executor.ts`). **(v2.3)** The ~18-tool flat list predates the package split: 2.3.0 slimmed the base Engine, and Maps, Calls, the table games, and music/Spotify tooling now ship as downloadable agent packages — so package-owned tools only exist when their package is installed. The core tools (`roll_dice`, `update_game_state`, the lorebook tools, the chat summary/variable tools, `update_about_me`) remain true Engine built-ins:
- `roll_dice` — parses dice notation like `"2d6+3"` or a bare `"d20"` and returns rolls, sum, total. **(v2.4.6)** One shared grammar now reads notation for `roll_dice`, `/roll` and the GM skill-check tag; notation whose total can't be computed exactly is rejected. **(v2.4.6, #5798/#5901)** Game Mode attaches the dice tool to **every** game turn whether or not Function Calling is on, and the GM is told to roll for any real number; rolls render as `/roll`-style dice cards kept per swipe, and text-only connections can still request dice (the GM gets the real results in a follow-up request). Only the dice tool rides along — the rest still needs Function Calling. **(v2.5.0, #6945)** In Roleplay, a `roll_dice` added under **Function Calling** actually rolls; if the **Rolls** command is also on, its **Who can roll dice** choice applies.
- `update_game_state` — **(narrowed in v2.4.6, #5798)** the GM's state tool now accepts only `location_change` / `time_advance`: it sets the game's shared clock or party location. It no longer offers stat, inventory or quest updates (those were reported as applied, then dropped) and refuses them with a message saying what it can do. Writes are **pending until the response is saved**, then confirmed on that message and swipe; locked fields and Spatial Context-owned locations are refused.
- `set_expression` — character changes its sprite.
- `trigger_event` — trigger an in-game event.
- `search_lorebook` — semantic search over lorebook entries. **(v2.4.6)** Also matches entry names, content and keys, includes entries without usable embeddings, and drops unrelated semantic hits. Game chats additionally need **Let the GM search lore** on.
- `save_lorebook_entry` — write a new lorebook entry. **(v2.1)** The agent/tool write-path size cap on entry content was removed — large entries written via this tool (or by the Lorebook Keeper agent) persist intact, with no pre-storage truncation.
- `edit_chat_message` — edit an existing chat message.
- `read_chat_summary`, `append_chat_summary` — read/append the chat's rolling summary.
- `read_chat_variable`, `write_chat_variable` — per-chat key/value state.
- `update_about_me` **(v2.2)** — lets the character rewrite its own "about me" profile. **Opt-in and default-off** (the user has to enable it per chat), and **Conversation-mode only** (server-enforced; it's not exposed in Game Mode). Takes `scope` + `content`: `scope: "public"` changes the character's real cross-chat bio that shows in every chat and is **surfaced to the user for approval first**; `scope: "chat"` writes a bio **private to that one conversation** (no approval needed). `content` may be empty to clear it. **(v2.3)** About Me and `update_about_me` stayed built into the Engine through the package split — they are **not** downloadable packages, and the tool's semantics are unchanged; as of 2.3.2, About Me *drafting* goes through Professor Mari instead of per-editor AI Write controls.
- Spotify/music: `spotify_get_playlists`, `spotify_get_playlist_tracks`, `spotify_search`, `spotify_play`, `spotify_set_volume`, `spotify_get_current_playback`. **(v2.3)** These six are Music DJ-owned — they exist only when the Music DJ agent package is installed, not in the base Engine.

Custom tools run through the same executor — they just hit the `default` case in the switch that tries the custom tools list.

## Custom Tools vs. Built-In Tools vs. Package-Owned Commands (v2.3)

Four distinct things now share the tools/commands space:

- **User-defined custom tools** — the subject of this file. Always available; created in the **Presets** panel's **Functions** section.
- **Engine built-in tools** — the core list above. Ship with the Engine, no download needed; built-in Conversation commands stay configurable without any downloads.
- **Package-owned commands** — commands belonging to downloadable agent packages. The six table games surface as **Commands toggles** (no Add Agent entries), and package-owned command toggles appear only for installed agents. Installed Conversation games **hot-activate their slash commands without an Engine restart** (#3699); route-bearing packages keep a safe restart path.
- **Package-contributed tools (v2.5.0, Capability API 1.19)** — a package with the `tools` permission calls `api.registerTool({ name, description, parameters, handler })`; the model sees it as `<packageId>_<name>` (`-` → `_`, ≤64 chars), schema-validated before the handler runs. It's attached on every turn while the package is active (no per-chat switch) and needs native tool calls. Name resolution is built-in → custom → package, so your custom tool wins a collision. Caps: 16 tools per package / 64 total, 512-char descriptions, 8 KiB schemas, 64 KiB results, 10s handler wait. Author API: `docs/development/optional-agent-packages.md`.

**Slash commands are package-gated:** `/illustrate` and `/selfie` are hidden until the Illustrator package is installed — if one is missing, install Illustrator from **Agents → Download Agents**. **(v2.5.0, #6874)** In Roleplay, the Gallery and `/illustrate` can make a one-off illustration with the installed Illustrator **without** enabling it (or automatic agents) for the chat — earlier guidance said every Gallery action needed Illustrator enabled per chat. Selfies stay opt-in per conversation (Chat Settings: "Enable Illustrator's Selfies command for this conversation"). Selfie prompt generation routes through the per-chat Prompt Model connection (#3638), and the Connections defaults category for image settings is now named **Images**.

## Best Practices

### Tool naming
- Use verbs or verb-nouns: `get_weather`, `lookup_customer`, `create_ticket`.
- Lowercase snake_case (the schema enforces this).
- Be specific: `get_latest_patch_notes` is better than `get_data`.

### Tool descriptions (critical for model calling quality)
- 1–2 sentences, imperative voice.
- Say what it does AND when to use it.
- If the tool has important limits, say them: "Returns the 10 most recent records. For older data, use `get_archive`."

Example — good:
> "Look up the WordPress site configuration for a given domain. Returns theme, active plugins, hosting provider, and last-updated timestamp. Use when the user asks about a specific client's site setup."

Example — bad:
> "Gets site data."

### Webhook design
- **Return JSON, not prose.** The model parses it better.
- **Keep responses small** — they go into the model's context. Trim to what's needed.
- **Return errors as structured JSON**: `{ "error": "Site not found", "suggestion": "Check domain spelling" }` — the model can explain these to the user gracefully.
- **Don't rely on the model to parse HTML** in your response. Parse server-side and return structured fields.
- **Handle timeouts gracefully on your end** — the server gives up after the custom-tool timeout (60s by default, `CUSTOM_TOOL_TIMEOUT_MS`). Design for low typical latency anyway; the model waits on the call.

### Parameter schemas
- **Required fields should be truly required.** If the tool has sensible defaults, mark optional.
- **Use enums for bounded choices.** `{"type": "string", "enum": ["low", "medium", "high"]}` — the model calls this more reliably than a freeform string.
- **Use `description` on every property.** This is what the model reads.

## Example: WordPress Site Lookup Tool (webhook)

**Tool definition** (build it in **Presets → Functions → Create function**, or import this object as-is via **Import functions from ZIP or JSON**):
```json
{
  "name": "get_site_config",
  "description": "Look up the WordPress configuration for a client site by domain. Returns theme, active plugins, PHP version, hosting, and last-update info. Use when the user asks about a specific site.",
  "executionType": "webhook",
  "webhookUrl": "https://your-backend.example.com/marinara/site-lookup",
  "parametersSchema": {
    "type": "object",
    "properties": {
      "domain": {
        "type": "string",
        "description": "The site's primary domain (e.g. 'clientname.com')"
      }
    },
    "required": ["domain"]
  }
}
```

**Your backend (Express):**
```javascript
app.post("/marinara/site-lookup", async (req, res) => {
  const { tool, arguments: args } = req.body;
  const { domain } = args;
  const site = await db.sites.findOne({ domain });
  if (!site) return res.json({ error: `No site found for ${domain}` });
  res.json({
    domain: site.domain,
    theme: site.theme,
    plugins: site.activePlugins,
    php: site.phpVersion,
    host: site.host,
    lastUpdated: site.lastUpdated,
  });
});
```

The character (given the right card framing) will call this when a user says "what's the setup on clientname.com?" and respond using the returned data.

## Example: Dice-based Skill Check (script)

```json
{
  "name": "skill_check",
  "description": "Roll a skill check against a DC. Returns the roll, modifier, total, and whether it succeeded.",
  "executionType": "script",
  "scriptBody": "const roll = Math.floor(Math.random() * 20) + 1; const total = roll + (args.modifier || 0); return { roll, modifier: args.modifier || 0, total, dc: args.dc, success: total >= args.dc, critical: roll === 20, fumble: roll === 1 };",
  "parametersSchema": {
    "type": "object",
    "properties": {
      "modifier": { "type": "integer", "description": "Stat modifier to add" },
      "dc": { "type": "integer", "description": "Difficulty class to beat" }
    },
    "required": ["dc"]
  }
}
```

Pure computation. No network. Fits the sandbox.

## Anti-Patterns

- **Using `static` in production** — it's a stub, not a tool. Useful for testing the model's willingness to call a tool; not useful for actual work.
- **Putting API keys in webhook URLs as query params** — encrypted at rest since v2.4.2, but still shown in the editor and written in plain text into every function export you share. Keep real credentials in your own backend's logic, not in the URL.
- **Returning huge JSON blobs** — every byte the webhook returns becomes tokens in the model's context. Trim.
- **Using `script` and then trying to import `node-fetch`** — won't work. Pivot to webhook.
- **No tool description** — the model won't know when to call it. Required for decent call rates.
- **Overlapping tools** — if you have both `get_user` and `lookup_user` with similar descriptions, the model will call the wrong one some of the time. Pick one, delete the other.

## UI Location

Custom tools are managed in the **Presets** panel → **Functions** section (caption "Custom function calls available from Chat Settings") — not the Agents panel, as earlier guidance said. The full-page editor is `packages/client/src/components/agents/ToolEditor.tsx`. Creating, editing, deleting, reordering or toggling a tool is a privileged action: from any device other than the server, the user must first save a matching admin secret (`ADMIN_SECRET`) under **Settings → Advanced → Admin Access**.

Tools are attached to chats via **Chat Settings → Function Calling**. A tool created in the panel is available globally; whether it's *active* in a given chat depends on that chat's tool list. A tool imported from a hand-edited file with a broken parameter schema is silently skipped at generation (server log only) — rebuild its parameters by hand.

**Tool portability (v2.3.4, #3953):** custom tools do **not** travel with agent files. Exported agents no longer bundle custom function definitions, and imported agent files cannot install functions, grant themselves tool access, or impersonate curated agent types. A recipient of a shared agent must **re-create (or already have) the tools and explicitly attach them** after import — any recommendation involving a shared agent file needs that step spelled out.

### UI naming: "Functions"

In the interface, custom tools are labelled **Functions** — both the **Presets → Functions** section and the chat's **Chat Settings → Function Calling** section have a wrench icon, and the actions read **Create function**, **Add Functions**, **Import functions from ZIP or JSON**, **Export functions to ZIP**. Use the UI wording when giving click-path instructions, and "custom tool" when talking about the schema. **Enable Tool Use** is off by default for a new chat. With it on and no tools added below, a chat can use *all* globally enabled tools (built-ins like dice rolls and lorebook search, plus every enabled custom tool); adding specific tools narrows it to that set.

**Force To Call Tool** (same section) asks a compatible model to call one enabled function before it answers; some models ignore it. **(v2.4.2, #4907)** It sends native required-tool controls for Gemini, Vertex AI and compatible Anthropic requests, falling back to automatic choice for manual Claude extended thinking and Mythos.

### ⚠️ Import security (v2.4.0; Script tools since v2.4.2)

**Imported webhook and Script tools always arrive disabled, with "Include hidden chat context" forced off** — regardless of what the imported file requested. After import, Marinara shows a review listing each executable tool's type, the webhook's **destination origin**, and what the file asked for (**Requested enabled**, **Requested hidden context**), so the user can inspect the full configuration before deliberately enabling it.

- **Only Static tools keep their imported enabled state.** (Changed in v2.4.2 — earlier guidance said Script tools kept theirs too; executable Script tools are now quarantined like webhooks.)
- An import **skips any tool whose name clashes** with an existing tool or a built-in tool name.
- **Profile imports (v2.4.2)** quarantine the same way: executable tools restored from a profile come back disabled for review.
- Agent packages neither bundle nor import custom tools (see portability above).

### Reserved names

A custom tool name cannot match a **built-in** tool name. Built-ins include `roll_dice`, `update_game_state`, `set_expression`, `trigger_event`, `search_lorebook`, `web_search`, and `update_about_me`, among others. Attempting to save one yields:

```text
"your_name" is a reserved built-in tool name.
```

Two custom tools also cannot share a name. This is the other half of the lowercase-snake_case rule — name collisions are the most common confusing save failure.

### Attaching tools to an agent

Tools attach to a specific **agent** as well as to a chat (`docs/extending/custom-tools.md` → "Attaching tools to an agent") — that's how a custom agent gains a callable capability. Remember tools do **not** travel with an exported agent file (#3953): the recipient must already have, or re-create, the tools and attach them explicitly.

### `includeHiddenContext`

The setting (**Include hidden chat context**) granting a tool hidden chat context beyond its declared parameters — chat mode, active persona name, character names, saved chat variables and, in Game Mode, the game state. Defaults to `false`, and **import forcibly strips it from webhook tools (v2.4.0) and Script tools (v2.4.2)** regardless of what the file requested — precisely because a webhook can forward whatever it receives to a third party.

Enable it deliberately, on tools you authored, where the tool genuinely needs scene context the model would otherwise have to restate in its arguments. Never enable it on an imported webhook without reading the destination URL first — the Functions panel surfaces the origin for exactly this reason.

### Generated-image result URL restriction (v2.4.0)

Private generated-image result URLs are restricted to the configured provider's **exact scheme, hostname, and port**. Public CDN results still work, but a redirect from a trusted local image provider can no longer reach a *different* private service. NovelAI ZIP image decompression is also bounded to **64 MiB**, with oversized declared output rejected before inflation and actual output required to match the archive metadata.

Relevant to anyone running a local image provider behind a proxy or redirect: a previously-working setup can now fail closed, and that needs to be diagnosable rather than mysterious.

**Advising implication:** any instruction to "import this tool bundle and you're done" is wrong for webhook and Script tools. The user must open each imported executable tool, inspect its complete URL or script body and its hidden-context setting, and turn it on. Include that step. When *sharing* a webhook tool, warn the recipient what origin it points at — Marinara will show them, and an unexplained third-party origin should be a stop sign.

## API Endpoints

- `GET /api/custom-tools` — list
- `POST /api/custom-tools` — create
- `PATCH /api/custom-tools/:id` — update
- `DELETE /api/custom-tools/:id` — delete

## Regex Scripts — Text Transforms, Not Tool Calls

Distinct from custom tools: **Regex Scripts** are SillyTavern-style find/replace transforms that rewrite text as it moves through the pipeline (prompts and/or model output). They don't give the model a callable capability — they mutate strings. Reach for this when a user asks *"how do I transform / clean up / rewrite the prompt or the output text"* (strip a leftover prefix, swap a name on the way in or out, hide a control token, tidy formatting) — **not** a custom tool.

- **What it does:** each script pairs a regex `find` with a `replace`, applied to prompt and/or output text — the SillyTavern regex model.
- **Where they live:** the global list is **Presets panel → Regexes** (`PresetsPanel.tsx`); character-scoped scripts sit in the Character editor's **Advanced → Regex Scripts** card (`CharacterRegexSection.tsx`); and a script can target specific **prompt presets** (v2.4.1 — see Scoping). Backed by a `regexScripts` DB table (`regex-scripts.ts`) with seeded defaults (`seed-regex.ts`); display-side application runs on the client (`use-apply-regex.ts`), prompt-side on the server. **(v2.5.0, #6755)** **Select regex scripts** in the Regexes list enables bulk **Export**/**Delete** — the way to swap in an updated regex pack.
- **SillyTavern-import-compatible:** existing ST regex scripts import over, the same way lorebooks/world-info do. Scripts embedded in an ST card import as **Character only** (default) or **Global**. Entries carrying unsupported ST placements are kept, with a warning naming the ignored values, instead of being dropped (preset regexes v2.4.2, #4959; character-scoped v2.4.3, #5036).
- **ReDoS safety validator (relaxed in v2.2):** each `find` pattern is screened for catastrophic-backtracking risk before it's saved/run. As of 2.2 the check is less aggressive — **linear, delimiter-bounded field patterns are now allowed** (e.g. `([^|]+)\|([^|]+)\|([^|]+)` for splitting pipe-delimited fields), which previously got flagged. **Overlapping broad-unbounded chains** (the actual catastrophic-backtracking shapes, e.g. stacked `.*`/`.+` with overlapping character classes) are still **rejected**. If a script is refused, rewrite it with bounded classes rather than greedy wildcards. **(v2.4.3)** A JSON regex-bundle import now *keeps* flagged scripts with a warning instead of skipping them — but prompt-side application still skips a pattern that fails the check, so rewrite it before relying on it.
- **Source of truth:** `docs/extending/regex-scripts.md`; schema `packages/shared/src/schemas/regex.schema.ts`.

### Fields (`regex.schema.ts`)

| Field | What it does |
|---|---|
| `findRegex` / `replaceString` / `flags` | The transform itself (`flags` default `gi`) |
| `placement` | **AI Output** and/or **User Input** (array, at least one) — which side the script runs on |
| `applyMode` | **Only Display / Only Prompt / Both** — see below |
| `promptOnly` | Restricts the script to prompt text |
| `minDepth` / `maxDepth` | Depth window; empty = any depth |
| `order` | Lower runs first; new scripts get the next free number on save |
| `trimStrings` | Strings stripped from the match |
| `enabled` | On/off |
| `targetCharacterIds` | Characters this script is scoped to (see scoping below) |
| `targetPromptPresetIds` | **(v2.4.1)** Prompt presets this script is limited to; default `[]` = all presets |

(`scriptIds` is not a script field — it's the reorder request's ordered ID list.)

### ⚠️ Apply Mode — the setting that decides whether the script does anything

Lives in **Advanced Options**, separate from Placement. **A new script starts on Only Display.**

- **Only Display** — changes only what you see on screen. The saved message and the text the model receives on later turns are **unchanged**. **(v2.4.6, #5994)** Applies during Roleplay streaming too (incomplete fragments are held until a regex matches), not only once the reply completes.
- **Only Prompt** — changes only what the model receives. Display and saved message unchanged. This is also what the prompt preview shows.
- **Both** — changes display and prompt.

**Pick by intent:** tidying how a reply *looks* → Only Display (safest, cosmetic). Stripping a tag the model keeps copying → Only Prompt. Both surfaces → Both.

> **Footgun.** For a **User Input** script, Only Display and Both rewrite the message **right before it is sent** — so they change what is actually saved and transmitted, not just how it renders afterward. **There is no display-only mode for your own outgoing messages.** Warn about this before recommending any User Input script.

This also means the default is a trap in the other direction: a user who writes a script to fix what the *model* sees, and leaves Apply Mode alone, gets a script that changes nothing about the prompt.

**Individual group chats (v2.5.0, #6637):** for Only Prompt / Both in a Roleplay **Individual** group chat, placement follows the character *receiving* the prompt — your messages **and other characters' messages** get **User Input** scripts, while the responder's own replies keep **AI Output** scripts. Character restrictions still decide who receives the rewritten prompt.

### Execution Order and Depth Range

Both in **Advanced Options**.

- **Execution Order** — a number; lower runs first. Matters when several scripts match the same text. New scripts start at 0 and the app assigns the next free number on save, so fresh scripts don't collide. Rows are drag-reorderable in the **Regexes** list.
- **Depth Range** — `Min`/`Max`, counting **backward from the newest message**: newest is depth **0**, the one before it 1, and so on. Leave both empty to run at any depth. **Saving is blocked if min > max.**

### Scoping — richer than "per-character"

A script can target **one or more** characters, two ways:

1. **In the editor** — the **Specific Characters** toggle in the **Apply To** card, then pick from the grid. Off = "Applies to all characters." At least one character is required when on. (Backed by `targetCharacterIds`.)
2. **Per character** — the character's **Advanced** tab has a **Regex Scripts** card listing only that character's scripts, with its own create/import/export. The character must be saved first.

It can also target **prompt presets (v2.4.1, #4446)**: the editor's **Specific Prompt Presets** toggle — "Run this script only while one of the selected prompt presets is active"; off = "Applies to all prompt presets" (backed by `targetPromptPresetIds`). **(v2.4.6, #5774)** A prompt preset's editor has a **Regex** tab listing the scripts that target it; linking an existing global script there stops it from running with other presets.

> **Scoped scripts do not run by default.** A per-chat **Scoped Regex Scripts** section appears in Chat Settings only when some character in the chat has scoped scripts, with three modes: **Disabled** (the built-in default — only global scripts run), **Exclusive** (each scoped script only touches messages from its own character), and **Chat** (every scoped script touches every message). Individual scripts can be toggled per chat underneath. This governs **display-side** scripts; **prompt scripts always follow the character actually generating the reply.**
>
> **(v2.4.6, #5774)** The prompt preset's **Regex** tab also sets a **Scoped regex default**: chats using that preset inherit it unless they pick their own mode (Chat Settings shows "Preset default: …" and a **Use preset default** button to return to it).
>
> This is the most likely cause of "I wrote a character regex and nothing happens" — check both the chat's mode and its preset's default.

(Regex Scripts were added in an intermediate 2.0.x update and documented in the 2.1 doc refresh — an established surface, not brand-new in 2.1.)

**Related, but not tools either:** for prompt-text logic (conditional macros with `||` / `&&` / parentheses / equality-list shorthand, and the `{{group}}` macro, both v2.3.4), see `conditional-prompts.md` and the Macros coverage in `architecture.md` and `character-cards.md`.
