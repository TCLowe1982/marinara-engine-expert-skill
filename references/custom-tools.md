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
  enabled: boolean,       // default: true
}
```

When the tool is enabled and the chat is configured to allow tools, the tool is added to the OpenAI-format `tools` array sent to the LLM. The model decides whether and when to call it. Multiple tools can be called in a single turn; the executor runs them sequentially.

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

**The URL must be HTTPS, and local/private targets are blocked by default.** The request goes through an SSRF-hardened `safeFetch`: only `https:` is allowed, and loopback/private/reserved hosts (`localhost`, `127.0.0.1`, `192.168.x.x`, etc.) are rejected unless the server sets `WEBHOOK_LOCAL_URLS_ENABLED=true`. So a `http://localhost:3100` dev backend won't work out of the box — expose it over HTTPS (e.g. a tunnel) or set `WEBHOOK_LOCAL_URLS_ENABLED=true` for local testing.

**This is the primary integration point for real work.** Use it to connect the character to:
- Your own backend (Express, Fastify, Cloudflare Worker, Lambda, anything that speaks HTTP).
- n8n, Zapier, Make, or any workflow automation tool.
- A lightweight Python/FastAPI service you wrote for the specific integration.
- A Google Apps Script web app.
- A Discord webhook (limited — one-way notification only, won't return useful data to the model).

**What to implement on your end:**
1. Accept `POST` with JSON body `{ tool: string, arguments: object }`.
2. Validate and process.
3. Return JSON. Keep it concise — whatever you return goes into the model's context.

**Error handling:** If the webhook fails (timeout, non-200, network error), the tool result becomes `{ error: "Webhook call failed: <msg>" }`. The model sees the error and can react — often retrying or apologizing to the user.

**When to use:** Any tool that needs to reach outside the engine. **This is the default recommendation for real functionality.**

### `script` — Sandboxed server-side JavaScript
**Disabled by default.** Script execution only runs if the server is started with `CUSTOM_TOOL_SCRIPT_ENABLED=true`; otherwise the call returns `{ error: "Script custom tools are disabled. Set CUSTOM_TOOL_SCRIPT_ENABLED=true to allow local code execution." }`. Tell the user to set that env var before recommending a script tool.

When enabled, the `scriptBody` string is executed via Node's `vm.runInNewContext` with the shared custom-tool timeout (**60s by default**, via `CUSTOM_TOOL_TIMEOUT_MS`). The script runs inside a wrapper: `"use strict"; (function() { <scriptBody> })()`.

**The sandbox exposes ONLY:**
- `args` — the tool arguments as an object
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

Marinara ships several built-in tools that work the same way:
- `roll_dice` — parses dice notation like `"2d6+3"` and returns rolls, sum, total.
- `update_game_state` — used by the GM in Game Mode to update world state.
- `set_expression` — used by characters to change their sprite.
- `trigger_event` — used to trigger in-game events.
- `search_lorebook` — semantic search over lorebook entries.
- Spotify tools: `spotify_get_playlists`, `spotify_get_playlist_tracks`, `spotify_search`, `spotify_play`, `spotify_set_volume`.

Custom tools run through the same executor — they just hit the `default` case in the switch that tries the custom tools list.

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

## API Endpoints

- `GET /api/custom-tools` — list
- `POST /api/custom-tools` — create
- `PATCH /api/custom-tools/:id` — update
- `DELETE /api/custom-tools/:id` — delete
