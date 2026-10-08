# Custom Tool + Webhook Recipe

Complete starter for building a custom tool that lets a character call an external service.

## 1. The Tool Definition (save in Marinara)

Open the **Presets** panel → **Functions** section (wrench icon) → **Create function**, pick **Webhook**, and fill in the fields below. The JSON is the tool's fields, importable as-is via **Import functions from ZIP or JSON** — but an imported webhook always arrives **disabled** with hidden context off, whatever `enabled` says, so open it, check the URL, and switch it on. (From a device other than the server, saving a tool needs a matching admin secret under **Settings → Advanced → Admin Access**.)

```json
{
  "name": "example_lookup",
  "description": "Look up an item by ID from the backing service. Returns structured details. Use when the user asks about a specific item by name or ID.",
  "executionType": "webhook",
  "webhookUrl": "https://your-backend.example.com/marinara/lookup",
  "enabled": true,
  "parametersSchema": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "description": "The unique identifier of the item (e.g. 'client-123', 'sku-A7', 'domain.com')"
      },
      "include_details": {
        "type": "boolean",
        "description": "If true, include the full detail record; if false, return summary only.",
        "default": false
      }
    },
    "required": ["id"]
  }
}
```

**Naming:** lowercase snake_case, specific verb-noun.
**Description:** 1-2 sentences. Say what it returns AND when to use it.
**Parameters:** required fields only in `required`. Use `enum` for bounded choices. Always include `description` on each property.

**Turn tool use on for the chat:** **Chat Settings → Function Calling → Enable Tool Use** (off by default for a new chat). With no tools added there, the chat gets every enabled custom tool plus the chat-eligible built-ins (including `web_search` — check it doesn't already cover your need); **Add Functions** narrows it to a chosen set. Claude and Grok *subscription* connections don't support tools at all. (A tool attached to an **agent** instead runs in that agent's call whether or not Enable Tool Use is on.)

## 2. Teach the Character to Use It (in the card)

In the character's `description` or `system_prompt`, mention the tool and when to use it:

> "When the user asks about a specific item by name, call `example_lookup` with the item's ID before answering. Use the returned data to give an accurate response. If the tool returns an error, tell the user you couldn't find it and suggest they check the spelling."

This framing massively improves call quality. Models rarely figure out tool use from the parameters schema alone.

## 3. The Webhook Backend (any language/framework)

The engine POSTs JSON to your URL with this shape (plus a `context` object when the tool has **Include hidden chat context** on):
```json
{
  "tool": "example_lookup",
  "arguments": { "id": "client-123", "include_details": true }
}
```

Marinara validates `arguments` against the tool's `parametersSchema` before calling you (a mismatch goes back to the model, not to you), but still validate them yourself.

With **Include hidden chat context** on, the body also carries `context`: `chatId`, `chatMode`, `personaId`/`personaName`, `characterId`/`characterName`, `characterIds`, `characterNames`, `characters`, `variables` (chat variables), `recentMessages` (IDs and roles only), `gameState`, and `macros` — which holds the primary character's **full card text** (description, personality, scenario, backstory, appearance, example dialogue, system prompt, post-history instructions), the persona's card text, and the user's **last message** (`macros.input`). Leave it off unless your backend needs that, and never on a webhook you don't control. Full list: `references/custom-tools.md` → `includeHiddenContext`.

You return JSON. Keep it concise — it becomes tokens in the model's context.

### Express (Node.js) minimal example

```javascript
const express = require("express");
const app = express();
app.use(express.json());

app.post("/marinara/lookup", async (req, res) => {
  const { tool, arguments: args } = req.body;
  const { id, include_details } = args;

  try {
    const item = await db.items.findById(id);
    if (!item) {
      return res.json({ error: `No item found with id '${id}'` });
    }
    res.json({
      id: item.id,
      name: item.name,
      status: item.status,
      ...(include_details && { details: item.fullDetails })
    });
  } catch (err) {
    res.json({ error: `Lookup failed: ${err.message}` });
  }
});

app.listen(3100);
```

### FastAPI (Python) minimal example

```python
from fastapi import FastAPI, Request

app = FastAPI()

@app.post("/marinara/lookup")
async def lookup(req: Request):
    body = await req.json()
    args = body.get("arguments", {})
    item_id = args.get("id")
    include_details = args.get("include_details", False)

    item = await db.items.find_by_id(item_id)
    if not item:
        return {"error": f"No item found with id '{item_id}'"}

    result = {
        "id": item.id,
        "name": item.name,
        "status": item.status,
    }
    if include_details:
        result["details"] = item.full_details
    return result
```

### Cloudflare Worker example

```javascript
export default {
  async fetch(request, env) {
    const { tool, arguments: args } = await request.json();
    const { id } = args;

    const item = await env.DB.prepare("SELECT * FROM items WHERE id = ?")
      .bind(id)
      .first();

    if (!item) {
      return Response.json({ error: `No item found with id '${id}'` });
    }
    return Response.json(item);
  }
};
```

## 4. Response Design

**Do:**
- Return structured JSON objects.
- Include an `error` key when things go wrong — with a human-readable message the model can relay.
- Trim fields to what the model actually needs.
- Use consistent field names across tools.

**Don't:**
- Return huge blobs of HTML or raw text.
- Return stack traces or internal IDs the model shouldn't expose.
- Put API keys in the URL query string (the URL is encrypted at rest since v2.4.2, but shown in the editor and written in plain text into every export).
- Take longer than the custom-tool timeout (60s by default, `CUSTOM_TOOL_TIMEOUT_MS`) — the engine aborts the call. Keep typical latency low; the model waits on it.

## 5. Testing

1. Create the tool in Marinara with `executionType: "static"` and `staticResult: "{ \"test\": true }"`.
2. Turn on **Enable Tool Use** for the chat, then ask a question that should trigger the tool. Verify the model calls it. If it never does, check the tool's on/off switch, the chat's added-tools list, and your descriptions. On a local model without native tool calls, Marinara can still run text-form `<tool_call>…</tool_call>` output on OpenAI-compatible connections (see `references/custom-tools.md` → Local models).
3. Switch to `webhook` and point at your backend. **Webhook URLs must be HTTPS, and loopback/private hosts are blocked by default** — a plain `http://localhost:3100` is rejected. For local dev, either start the server with `WEBHOOK_LOCAL_URLS_ENABLED=true`, or expose the backend over HTTPS (e.g. a Tailscale/ngrok-style tunnel).
4. Watch your backend logs. Iterate on the schema description until call quality is good.

## 6. Security Notes

- **Marinara is local-first.** Your webhook URL is stored in the user's local file-native storage (under `DATA_DIR/storage`), encrypted at rest since v2.4.2. Not exposed externally — but **Export function** writes it in plain text, so check exports before sharing.
- **Don't trust tool arguments blindly.** The model can and will hallucinate values. Validate in your backend.
- **Auth:** if your backend is remote, add authentication. Marinara sends no custom headers (only `Content-Type: application/json`), so a shared-secret *header* isn't configurable. Options: an unguessable secret path segment in the URL (strip it from anything you share), an IP allowlist, or a private tunnel like Tailscale.
- **HTTPS-only + no local targets by default.** The server makes the call through an SSRF-hardened fetch that allows only `https:` and blocks loopback/private/reserved IPs unless `WEBHOOK_LOCAL_URLS_ENABLED=true`. Responses are capped at 512KB.
- **CORS doesn't apply** — the Marinara server (not browser) makes the request. No preflight, no CORS headers needed.

## 7. Common Patterns

### Read-only lookup (most common)
`get_customer`, `get_product`, `get_patch_notes` — single-arg tool, returns structured record.

### List/search
`search_customers`, `list_products` — takes a query string, returns an array of summary records.

### Write action
`create_ticket`, `send_email` — takes full params, returns success/failure + ID. Be careful with destructive actions; consider requiring the model to confirm with the user first (framing in the card).

### State machine
`start_workflow`, `advance_workflow`, `complete_workflow` — multiple tools that share state managed server-side. Use a chat-scoped ID to track.

### Aggregation
`get_summary` — runs a complex query and returns a digest. Offload heavy work to the backend, let the model talk about the result.
