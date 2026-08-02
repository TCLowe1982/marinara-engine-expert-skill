# Custom Tools

Custom tools are the primary modding surface for **giving a character real capabilities**. They expose user-defined functions to the main chat model as OpenAI-compatible function definitions. When the model decides to call a tool, the server executes it and feeds the result back into the conversation.

**Source of truth:** `packages/server/src/services/tools/tool-executor.ts` and `packages/shared/src/schemas/custom-tool.schema.ts`.

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
}
```

When the tool is enabled and the chat is configured to allow tools, the tool is added to the OpenAI-format `tools` array sent to the LLM. The model decides whether and when to call it. Multiple tools can be called in a single turn; the executor runs them sequentially.

**Local models:** native (OpenAI-compatible) tool calling only fires on the local llama.cpp sidecar when it's launched with `--jinja` — gated by the runtime's native-tool-calls toggle (`enableNativeToolCalls`). Without it, custom tools won't be called on a local model even if defined. Frontier provider models call tools normally.

**Connection Custom Parameters (v2.3):** saved Custom Parameters on a Connection apply to **every** API-backed text generation on that connection — including Noodle and locally hosted custom endpoints — while per-chat/per-call overrides still take precedence. Arbitrary JSON and bare string parameter values are preserved as-is, and unified reasoning-effort requests work again for discovered OpenRouter models (#3688). **(v2.3.4, #3845)** Enabled Connection generation defaults now apply across **every Noodle text-generation path**, and custom OpenAI-compatible endpoints accept explicitly enabled **top-k**, **reasoning-effort**, and **verbosity** parameters.

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

**Error handling:** If the webhook fails (timeout, non-200, network error), the tool result becomes `{ error: "Webhook call failed: <msg>" }`. The model sees the error and can react — often retrying or apologizing to the user.

**When to use:** Any tool that needs to reach outside the engine. **This is the default recommendation for real functionality.**

### `script` — Sandboxed server-side JavaScript
**Disabled by default.** Script execution only runs if the server is started with `CUSTOM_TOOL_SCRIPT_ENABLED=true`; otherwise the call returns `{ error: "Script custom tools are disabled. Set CUSTOM_TOOL_SCRIPT_ENABLED=true to allow local code execution." }`. Tell the user to set that env var before recommending a script tool.

When enabled, the `scriptBody` string is executed via Node's `vm.runInNewContext` with the shared custom-tool timeout (**60s by default**, via `CUSTOM_TOOL_TIMEOUT_MS`). The script runs inside a wrapper: `"use strict"; (function() { <scriptBody> })()`.

**The sandbox exposes ONLY:**
- `args` — the tool arguments as an object
- `context` — the current-turn runtime context, or `null` (only populated when the tool has `includeHiddenContext: true`)
- `JSON` — with `.parse` and `.stringify`
- `Math`
- `String`, `Number`, `Date`, `Array`
- `parseInt`, `parseFloat`, `isNaN`, `isFinite`
- `console` — with a no-op `console.log`

**The sandbox does NOT expose:**
- `fetch`, `XMLHttpRequest`, or any network
- `require`, `import`, or module loading
- `process`, `globalThis`, `__dirname`
- Filesystem (`fs`, `path`)
- Timers (`setTimeout`, `setInterval`) — only the wrapper timeout applies
- Any Node built-ins beyond the above

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
- `roll_dice` — parses dice notation like `"2d6+3"` and returns rolls, sum, total.
- `update_game_state` — GM updates world state in Game Mode.
- `set_expression` — character changes its sprite.
- `trigger_event` — trigger an in-game event.
- `search_lorebook` — semantic search over lorebook entries.
- `save_lorebook_entry` — write a new lorebook entry. **(v2.1)** The agent/tool write-path size cap on entry content was removed — large entries written via this tool (or by the Lorebook Keeper agent) persist intact, with no pre-storage truncation.
- `edit_chat_message` — edit an existing chat message.
- `read_chat_summary`, `append_chat_summary` — read/append the chat's rolling summary.
- `read_chat_variable`, `write_chat_variable` — per-chat key/value state.
- `update_about_me` **(v2.2)** — lets the character rewrite its own "about me" profile. **Opt-in and default-off** (the user has to enable it per chat), and **Conversation-mode only** (server-enforced; it's not exposed in Game Mode). Takes `scope` + `content`: `scope: "public"` changes the character's real cross-chat bio that shows in every chat and is **surfaced to the user for approval first**; `scope: "chat"` writes a bio **private to that one conversation** (no approval needed). `content` may be empty to clear it. **(v2.3)** About Me and `update_about_me` stayed built into the Engine through the package split — they are **not** downloadable packages, and the tool's semantics are unchanged; as of 2.3.2, About Me *drafting* goes through Professor Mari instead of per-editor AI Write controls.
- Spotify/music: `spotify_get_playlists`, `spotify_get_playlist_tracks`, `spotify_search`, `spotify_play`, `spotify_set_volume`, `spotify_get_current_playback`. **(v2.3)** These six are Music DJ-owned — they exist only when the Music DJ agent package is installed, not in the base Engine.

Custom tools run through the same executor — they just hit the `default` case in the switch that tries the custom tools list.

## Custom Tools vs. Built-In Tools vs. Package-Owned Commands (v2.3)

Three distinct things now share the tools/commands space:

- **User-defined custom tools** — the subject of this file. Always available; created in the Agents panel.
- **Engine built-in tools** — the core list above. Ship with the Engine, no download needed; built-in Conversation commands stay configurable without any downloads.
- **Package-owned commands** — commands belonging to downloadable agent packages. The six table games surface as **Commands toggles** (no Add Agent entries), and package-owned command toggles appear only for installed agents. Installed Conversation games **hot-activate their slash commands without an Engine restart** (#3699); route-bearing packages keep a safe restart path.

**Slash commands are package-gated:** `/illustrate` and `/selfie` are hidden until the Illustrator package is installed, and the Gallery Illustrate/Selfie/Storyboard/Video/Animate/Background actions require Illustrator installed **and enabled per chat**, in every mode. If a user reports a missing `/illustrate` or `/selfie` command, the fix is to install Illustrator from **Agents → Download Agents**, then enable it for the chat. Selfie prompt generation routes through the per-chat Prompt Model connection (#3638), and the Connections defaults category for image settings is now named **Images**.

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

**Tool definition (saved in the Agents panel → Custom Tools):**
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
- **Putting API keys in webhook URLs as query params** — they're stored plaintext in the DB and visible in the UI. Use bearer tokens in your own backend's logic, not in the URL.
- **Returning huge JSON blobs** — every byte the webhook returns becomes tokens in the model's context. Trim.
- **Using `script` and then trying to import `node-fetch`** — won't work. Pivot to webhook.
- **No tool description** — the model won't know when to call it. Required for decent call rates.
- **Overlapping tools** — if you have both `get_user` and `lookup_user` with similar descriptions, the model will call the wrong one some of the time. Pick one, delete the other.

## UI Location

Custom tools are managed in **Agents Panel → Custom Tools** (the panel has a "Custom Tools" subsection below the agent list). The full-page editor is `packages/client/src/components/agents/ToolEditor.tsx`.

Tools are attached to chats via chat settings. A tool created in the panel is available globally; whether it's *active* in a given chat depends on that chat's tool list.

**Tool portability (v2.3.4, #3953):** custom tools do **not** travel with agent files. Exported agents no longer bundle custom function definitions, and imported agent files cannot install functions, grant themselves tool access, or impersonate curated agent types. A recipient of a shared agent must **re-create (or already have) the tools and explicitly attach them** after import — any recommendation involving a shared agent file needs that step spelled out.

### UI naming: "Functions"

In the interface, custom tools are labelled **Functions** — the section under Chat Settings has a wrench icon, and the actions read **Create function**, **Add Functions**, **Import functions from ZIP or JSON**, **Export functions to ZIP**. Use the UI wording when giving click-path instructions, and "custom tool" when talking about the schema. With **Enable Tool Use** on and no tools added below, a chat can use *all* globally enabled tools (built-ins like dice rolls and lorebook search, plus every enabled custom tool); adding specific tools narrows it to that set.

### ⚠️ Import security (v2.4.0)

**Imported webhook tools always arrive disabled, with "Include hidden chat context" forced off** — regardless of what the imported file requested. After import, Marinara shows the webhook's **destination origin** and the permissions the file asked for, so the user can inspect the full configuration before deliberately enabling it.

- **Static and Script tools keep their imported enabled state.** Only webhooks are force-disabled — they're the ones that can exfiltrate to a third party.
- An import **skips any tool whose name clashes** with an existing tool or a built-in tool name.
- Agent packages neither bundle nor import custom tools (see portability above).

**Advising implication:** any instruction to "import this tool bundle and you're done" is wrong for webhook tools. The user must open each imported webhook, inspect its complete URL and hidden-context setting, and turn it on. Include that step. When *sharing* a webhook tool, warn the recipient what origin it points at — Marinara will show them, and an unexplained third-party origin should be a stop sign.

## API Endpoints

- `GET /api/custom-tools` — list
- `POST /api/custom-tools` — create
- `PATCH /api/custom-tools/:id` — update
- `DELETE /api/custom-tools/:id` — delete

## Regex Scripts — Text Transforms, Not Tool Calls

Distinct from custom tools: **Regex Scripts** are SillyTavern-style find/replace transforms that rewrite text as it moves through the pipeline (prompts and/or model output). They don't give the model a callable capability — they mutate strings. Reach for this when a user asks *"how do I transform / clean up / rewrite the prompt or the output text"* (strip a leftover prefix, swap a name on the way in or out, hide a control token, tidy formatting) — **not** a custom tool.

- **What it does:** each script pairs a regex `find` with a `replace`, applied to prompt and/or output text — the SillyTavern regex model.
- **Scope:** scripts are scoped **per-character** (Character editor's regex section, `CharacterRegexSection.tsx`) and **per-preset** (Presets panel, `PresetsPanel.tsx`). Backed by a `regexScripts` DB table (`regex-scripts.ts`) with seeded defaults (`seed-regex.ts`); applied on the client via `use-apply-regex.ts`.
- **SillyTavern-import-compatible:** existing ST regex scripts import over, the same way lorebooks/world-info do.
- **ReDoS safety validator (relaxed in v2.2):** each `find` pattern is screened for catastrophic-backtracking risk before it's saved/run. As of 2.2 the check is less aggressive — **linear, delimiter-bounded field patterns are now allowed** (e.g. `([^|]+)\|([^|]+)\|([^|]+)` for splitting pipe-delimited fields), which previously got flagged. **Overlapping broad-unbounded chains** (the actual catastrophic-backtracking shapes, e.g. stacked `.*`/`.+` with overlapping character classes) are still **rejected**. If a script is refused, rewrite it with bounded classes rather than greedy wildcards.
- **Source of truth:** `docs/extending/regex-scripts.md`.

(Regex Scripts were added in an intermediate 2.0.x update and documented in the 2.1 doc refresh — an established surface, not brand-new in 2.1.)

**Related, but not tools either:** for prompt-text logic (conditional macros with `||` / `&&` / parentheses / equality-list shorthand, and the `{{group}}` macro, both v2.3.4), see the Macros coverage in `architecture.md` and `character-cards.md`.
