# Client Extensions (CSS + JS)

Client-side extensions let users modify Marinara Engine's **UI** at runtime. CSS for styling, JavaScript for DOM manipulation and behavior. Extensions have access to the engine's own `/api/*` endpoints via a scoped API object.

Think "userscripts + userstyles" — but with a proper API surface and auto-cleanup.

**Source of truth:** `packages/client/src/components/layout/CustomThemeInjector.tsx`.

## What Extensions Can Do

Extensions are loaded by `CustomThemeInjector`, which runs in the client React tree. Each enabled extension's CSS is injected as a `<style>` tag, and its JavaScript is executed with a scoped `marinara` API object.

### Capabilities
- Inject CSS (styling, themes, tweaks)
- Add DOM elements to the page
- Listen to events (clicks, input, mutations)
- Watch for DOM changes via MutationObserver
- Call Marinara's own server API (characters, chats, lorebooks, etc.)
- Schedule work with timers

### Limits
- Browser-sandboxed (no Node APIs, no filesystem)
- No access to other domains' data
- Must not interfere with React's reconciliation (careful with DOM mutations)
- No server-side code — if you need a backend, run it separately and call it via fetch

## The `marinara` Extension API

When a JS extension loads, `CustomThemeInjector` builds an ES-module source, serves it as a `Blob` via `URL.createObjectURL`, and dynamically `import()`s it. The module pulls its `marinara` API from a global registry (`globalThis.__marinaraExtensionApis`) keyed per extension — it is **not** passed as a `new Function` argument. The code runs in module strict mode and gets a `marinara` object with these methods:

### `marinara.extensionId` / `marinara.extensionName`
Read-only identifiers for the current extension. Useful for namespacing DOM IDs, storage keys, etc.

### `marinara.addStyle(css: string): HTMLStyleElement`
Inject a `<style>` element with the given CSS. Automatically removed when the extension is disabled/unloaded.

```javascript
marinara.addStyle(`
  .message-user { border-left: 3px solid red; }
`);
```

### `marinara.addElement(parent, tag, attrs?): Element | null`
Add a DOM element to the given parent. `parent` can be an Element or a CSS selector string. `attrs` is an object of attributes to set; `innerHTML` and `textContent` are special-cased. Returns the new element (or `null` if parent not found). Automatically removed on cleanup.

```javascript
const btn = marinara.addElement("header.chat-header", "button", {
  innerHTML: "📸 Screenshot",
  className: "my-ext-button",
  style: "margin-left: 8px;"
});
```

### `marinara.apiFetch(path: string, options?: RequestInit): Promise<any>`
Fetch from Marinara's own `/api/*` with JSON defaults. Returns parsed JSON.

```javascript
const characters = await marinara.apiFetch("/characters");
const chat = await marinara.apiFetch(`/chats/${chatId}`);
```

You can do POST/PATCH/DELETE too — just pass `options`:
```javascript
await marinara.apiFetch("/characters", {
  method: "POST",
  body: JSON.stringify({ data: { name: "New Char", description: "..." } })
});
```

**Note:** `Content-Type: application/json` is set by default.

**Denylist:** `apiFetch` blocks `/extensions`, `/extensions/*`, `/admin`, and `/admin/*` (checked against the canonical URL pathname, so encoded traversal like `%2e%2e/admin` is also caught). An extension can't re-install/modify extensions or reach privileged admin routes through it.

### `marinara.on(target, event, handler)`
addEventListener with auto-cleanup. `target` is an EventTarget (element, document, window).

```javascript
marinara.on(document, "keydown", (e) => {
  if (e.key === "Escape") console.log("escape pressed");
});
```

### `marinara.observe(target, callback, options?): MutationObserver | null`
MutationObserver with auto-cleanup. `target` can be Element or CSS selector. `options` defaults to `{ childList: true, subtree: true }`.

```javascript
marinara.observe("main.chat", (mutations) => {
  for (const m of mutations) {
    if (m.addedNodes.length) console.log("new message rendered");
  }
});
```

### `marinara.setInterval(fn, ms): number`
setInterval with auto-cleanup.

### `marinara.setTimeout(fn, ms): number`
setTimeout with auto-cleanup.

### `marinara.onCleanup(fn)`
Manually register a cleanup function to run when the extension is disabled/unloaded.

```javascript
const ws = new WebSocket("wss://example.com/feed");
marinara.onCleanup(() => ws.close());
```

## Writing an Extension

An extension has two string fields — `css` and `js` — both optional but at least one should be present. **As of v2.0 extensions are persisted server-side** via the `/api/extensions` CRUD routes (`packages/server/src/routes/extensions.routes.ts`). The old client-only `useUIStore.installedExtensions` (localStorage) list is now just a legacy store that's migrated to the server once on load, then cleared.

### Minimal CSS-only extension
```json
{
  "id": "ext-warm-theme",
  "name": "Warm Theme Tweak",
  "enabled": true,
  "css": ".message-ai { background: #2a1a0f; } .input-area { border-color: #8a5a2f; }",
  "js": ""
}
```

### JS extension with DOM manipulation
```javascript
// This is the ext.js content
marinara.addStyle(`
  .token-counter {
    position: fixed;
    bottom: 8px;
    right: 8px;
    padding: 4px 8px;
    background: rgba(0,0,0,0.6);
    color: #fff;
    font-size: 12px;
    border-radius: 4px;
    z-index: 9999;
  }
`);

const counter = marinara.addElement(document.body, "div", {
  className: "token-counter",
  textContent: "0 tokens"
});

// Rough estimate: 4 chars per token
function updateCount() {
  const input = document.querySelector("textarea.chat-input");
  if (!input || !counter) return;
  const tokens = Math.ceil(input.value.length / 4);
  counter.textContent = `~${tokens} tokens`;
}

marinara.on(document, "input", updateCount);
marinara.setInterval(updateCount, 1000);
```

### API-using extension
```javascript
// Show a "favorite characters" picker at the top of the sidebar
async function buildFavoritesBar() {
  const chars = await marinara.apiFetch("/characters");
  const favs = chars.filter(c => {
    const d = typeof c.data === "string" ? JSON.parse(c.data) : c.data;
    return d.extensions?.fav === true;
  });

  const bar = marinara.addElement("aside.sidebar", "div", {
    className: "favorites-bar",
    style: "display:flex; gap:4px; padding:8px;"
  });

  if (!bar) return;

  for (const c of favs) {
    const d = typeof c.data === "string" ? JSON.parse(c.data) : c.data;
    marinara.addElement(bar, "button", {
      textContent: d.name,
      className: "fav-btn",
      onclick: `location.href='/chat/new?charId=${c.id}'`
    });
  }
}

buildFavoritesBar();
```

## Installation and Distribution

There's no central marketplace yet. Distribution is manual — a JSON payload or pasted CSS/JS — and v2.0 adds **folder/zip import/export**: extensions export as a zip with a `marinara-extensions.json` envelope (`kind: "marinara.extension-folder"`) plus per-extension `manifest.json` + `extension.css`/`extension.js`, so a multi-file extension travels as one package (`packages/client/src/lib/extension-transfer.ts`).
- In **Settings → Extensions**, users add the extension with its CSS/JS content.
- Extensions can be enabled/disabled individually.
- They're **persisted server-side** (`/api/extensions`) and sync across sessions; any legacy localStorage entries are migrated once on load.

**Professor Mari can build extensions and themes for you.** Her Home-screen *workspace agent* (Pi-backed) can create/edit browser extensions, custom themes, agents, and custom tools via a `mari` CLI (`mari db` over `installed_extensions`/`agent_configs`/`custom_tools`, `mari themes`), asking for browser approval before database changes. So "make me an extension that does X" is a viable in-app path, not just hand-authoring.

## Common Patterns

### Theme/style tweaks
**Check Settings → Appearance first.** v2.0 made a lot of theming native: app background color + gradient presets, accent color, accent RGB mode, accent pulse, chat text/chrome colors, font family/size, and a one-click "Reset Appearance" — plus a server-synced **custom themes** system (`/api/themes`). Reach for a custom-CSS extension only for structural/DOM changes the native controls can't express. When you do, target existing class names (via DevTools) and respect the CSS custom properties in `globals.css`. (Professor Mari can also create/edit themes and extensions for you — see below.)

### Behavioral additions
JS with `addStyle` + `addElement`. Use `observe` to react to chat updates. Keep listeners lightweight — the chat DOM mutates constantly during streaming.

### External integrations
JS with `apiFetch` (for the engine's own data) + `fetch` (for external services). Respect CORS — if you're calling a third-party API, it has to allow cross-origin requests from your client.

### Debug overlays
JS that adds a fixed-position panel showing internal state (token counts, active lorebook entries, current agent runs). Useful for power users tuning their prompts.

## What Extensions CAN'T Do

- **Modify the server-side generation pipeline** — that lives in `generate.routes.ts`, not user-hookable.
- **Add new agent types** — agents are server-side; use Custom Agents instead.
- **Install new chat modes** — hardcoded.
- **Hook into message streaming tokens** — you see finished chunks but can't intercept mid-stream.
- **Access the user's API keys** — encrypted at rest, never exposed to client JS.
- **Persist custom data in a structured way** — use localStorage, but it's not integrated with the DB.

If you need any of these, **fork the engine**.

## Pitfalls

### React reconciliation conflicts
Don't mutate DOM elements that React manages. Prefer adding your own elements to containers, and if you modify existing elements, expect them to be re-rendered.

### Memory leaks without cleanup
Always use the `marinara` helpers (`addStyle`, `addElement`, `on`, `observe`, `setInterval`, `setTimeout`) — they auto-clean. If you use raw APIs, register cleanup via `onCleanup`.

### Heavy observers
Don't observe `document.body` with `{ childList: true, subtree: true }` if you only care about one subtree. Every chat message triggers lots of mutations; cheap handlers matter.

### CSP conflicts
Some extensions may conflict with the app's Content Security Policy. If something works in DevTools but fails when installed as an extension, it's likely CSP.

### Hot-reload during dev
If you're editing an extension and it gets stuck, disable and re-enable it in Settings → Extensions to force a reload.

## When to Use Extensions vs. Other Surfaces

**Extension** — client-side UI/UX changes.
**Custom Agent** — server-side per-turn LLM behavior.
**Custom Tool** — model-invoked action (client or server).
**Character card** — how the AI speaks.
**Lorebook** — what the AI knows.

If the user's request is "I want the UI to do X" → extension.
If the request is "I want the AI to do X" → tool or agent, not extension.
