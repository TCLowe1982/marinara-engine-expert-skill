# Themes and Personal Extensions

> **⚠️ If you remember "extensions were removed from Marinara," that is stale.** They *were* removed in v2.3.4 — and **reintroduced in v2.3.5 as sandboxed Personal Extensions** (with UI contribution slots), then expanded in v2.4.0 (Browser Extension API v5, Full page access compatibility mode) and through v2.5.0 (a documented hand-authoring path, button surfaces, `estimateTextTokens`). The removal is history. Answer from this file, not from memory.
>
> The 2.3.4 data loss is still real for anyone upgrading across it: extension code and `marinara.storage` bags from the pre-2.3.4 era were permanently erased on first 2.3.4 startup and are **not** restored by 2.3.5. Recovery requires a pre-2.3.4 database backup or an old zip export. The new system starts empty.

Marinara has two distinct user-side customization surfaces under **Settings > Addons**: **themes** (styling) and **Personal Extensions** (behavior). Both are ideation work — neither goes through the PR process.

---

## Part 1: Themes (styling)

For look-and-feel only. Themes are server-synced custom CSS kept in the **Theme Library** (**Settings > Addons**), alongside the native **Settings > Appearance** controls (accent/chroma, dialogue colors, text scale, chat backgrounds). Only one theme is active at a time.

Reach for a theme when the ask is purely visual. Reach for native settings first when the ask is covered there:

- **Accent, dialogue color, text scale** — no custom CSS needed. The default accent is **Marinara Gradient** (the logo's pink/orange/cyan; v2.4.6, #6028 — `docs/appearance/appearance-settings.md` still says `#d4acfb`; the code wins). As of 2.3.5, **Default Dialogue Color** is permanently active for cards without their own color (its Appearance toggle was removed), and card-level colors still win.
- **Chat widget style (v2.5.0, #7034/#7081/#7092)** — at the bottom of **Settings → Appearance → App Style**: **Default**, **Dottore** (icy blue, cut corners) or **Mari** (gold-trimmed storybook) frames for the movable chat buttons, windows and sections, in light or dark mode. **Font**, **Shape**, **Border & Buttons Color**, **Background Color** and **Text Color** (solid or gradient) override the preset; picking a preset resets them. **Button size (px)** (32–96) resizes movable chat buttons independently of Display Size. **Apply preset font / shape / colors** (off by default, independent) carry the look to messages, input boxes, chat controls and popups, and Game HUD widgets, map panel and character sheets; Conversation messages keep their own shape.
- **Color Character Names in Text** (**Text Rules**, v2.4.4, #5321) — colors character names and aliases inline with each character's name color (gradients supported; sub-toggle **Force Solid Colors for Inline Names**); names inside dialogue quotes are skipped and only characters in the chat qualify. The native answer to "color names with regex/CSS".
- **Reduce Ambient Animations & Effects** (v2.4.2, #4631) — one switch that cuts ambient animation and costly backdrop blur, and follows the OS reduced-motion preference.
- **Conversation background image opacity** (v2.5.0) — dims the Conversation background; its readability gradient stays. (`docs/appearance/chat-backgrounds.md` still says Conversation shows only a gradient — the code wins.)
- **Visual Style** (**App Style**) — **Default (Marinara)** or **SillyTavern**, a clean minimal ST-like skin for the whole app. The native answer to "make it look like SillyTavern" — no theme needed (it's only a skin, unrelated to ST import).
- **Text Outline / Stroke** (color + width 0–5px) and **Chat Chrome Text Color** (tracker widgets, folder labels, settings descriptions), in **Text & Scale** — readability over busy backgrounds without CSS.
- **Chat position** (**Appearance → Roleplay Presentation**; v2.5.0, #7106) — **Left** / **Center** (default) / **Right** for Roleplay on wide screens; messages and input move together and stay clear of sidebars and a same-side Tracker Panel. No effect on phones or in Game. The native answer to "move the chat column with CSS".
- **Custom Mouse Pointer** (default on) — Marinara's accent cursor; turning it off is what lets a theme control the cursor, so do that before writing a theme cursor.

**Theme hooks for chat windows (v2.5.0):** custom CSS can restyle the movable windows, drawers and minimized-window bubbles through public classes (`.mari-window`, `.mari-window__header`, `.mari-window__body`, `.mari-drawer`, `.mari-drawer__body`, `.mari-window-bubble`, …), data attributes (`data-window`, `data-locked`, `data-presentation="sheet"` on phones) and variables (`--mari-window-bg`, `--mari-window-border`, `--mari-window-radius`, `--mari-window-font-family`, `--mari-drawer-radius`, …; `--mari-window-ornament: none` hides the preset title ornament). Theme rules win without `!important`, and these variables override the widget-style preset colors (choose **Default** first to drop preset decoration). **Messages, inputs and chat controls** have their own hooks: classes `.mari-chat-style-surface`, `.mari-chat-style-conversation`, `.mari-chat-style-text`, `.mari-chat-style-control` and variables `--mari-chat-font-family`, `--mari-chat-bg`, `--mari-chat-text`, `--mari-chat-border`, `--mari-chat-radius`, `--mari-chat-control-*`, `--mari-chat-input-bg`. **The `--mari-chat-*` variables do nothing unless the matching Apply preset font / shape / colors switch is on** — or target the classes directly. Full reference: `docs/appearance/custom-css-themes.md` → "Styling chat windows and drawers" / "Styling messages, input boxes and chat controls". Professor Mari knows these hooks and can write a widget theme.

**What bites in theme CSS** (`docs/appearance/custom-css-themes.md`):

- **Sanitized before it runs.** Every `url()` except `data:` image/font URIs becomes `url(about:invalid)`; `@import` and `@namespace` are stripped; an `@font-face` survives only if every source is a font `data:` URI (no `local()`). So remote images, `@import` of Google Fonts and linked font files silently do nothing — embed as `data:` URIs, or add the font natively (**Text & Scale → Font**; Google Fonts download, `docs/appearance/fonts.md`).
- **Limits:** name ≤200 chars, CSS ≤**256 KiB measured in UTF-8 bytes**; larger is rejected on save or import.
- **Theme Library:** **Create Theme** saves *and activates*; **Import File** takes a `.css` (one theme, named after the file) or `.json` (a Marinara export, or `{ "name": "…", "css": "…" }`) — imports do **not** auto-activate, and a same-name, same-CSS import is skipped. **Default Theme** turns custom theming off, and **Reset Appearance** also deactivates the active theme.
- **Remote management:** creating, editing, importing, activating and removing themes from another device needs `ADMIN_SECRET` on the server + the same value under **Settings → Advanced → Admin Access** (loopback works without it).

**Theme vs. Card CSS — two independent CSS layers, both can be on at once.** A theme repaints the whole app (server-synced, may override core tokens, use `!important` and `position: fixed`). **Card CSS** ships inside a character's (or persona's) **Creator Notes** as a `<style>` block, styles **only the chat** (scope rules with `[data-card-css]`; target a mode with `@chat-mode roleplay|conversation|game`), and must be switched on per chat under **Chat Settings → Card Theming** (**Disabled** by default / **Exclusive** / **Chat**; the control appears only when a character in the chat has CSS). Its sanitizer is stricter: core tokens like `--primary`/`--background` stripped, `!important` stripped, `position: fixed` → `absolute`, `:has()` blocked, external `url()`/`@import` stripped. Route "my character should have its own look" to Card CSS (`character-cards.md`, `docs/appearance/card-css-theming.md`); when the app looks wrong, check both.

Themes cannot add behavior, read data, or run JavaScript. That's what extensions are for. A profile import brings the active theme back inactive, for deliberate re-enabling (v2.4.2).

---

## Part 2: Personal Extensions (behavior)

**Settings > Addons > Personal Extensions.** The default empty-state message:

> Ask Professor Mari to create an extension for you. Nothing runs until you enable it and approve the exact code hash.

### The authorship model (this trips people up)

There is **no "New Draft" button and no import control** in the Personal Extensions section. Code gets in two ways:

1. **Professor Mari drafts (the default path, no gates).** The user asks her to create or revise a draft. She can write and save code; **she cannot approve or enable it, and she cannot request Full page access.**
2. **Hand-written code (authoring guide added in v2.4.3, #5026).** Code the user writes and imports is treated as an **External Extension** — both external gates must be open (see External Extensions below), it imports **disabled**, and runs only after exact-hash approval. Authoring guide: `docs/extending/writing-personal-extensions.md`; importable examples in `docs/examples/personal-extensions/` (`browser-minimal`, `server-minimal`); starter here: `assets/personal-extension.template.js`. (Changed — earlier guidance said Mari was the only author. She is the only author *inside the Personal Extensions section*.)

Every draft or import starts **disabled**. Marinara fingerprints the exact executable code with **SHA-256**. The user opens the draft, reads the code, compares the displayed hash, and clicks **Review and Run** only if they accept that exact version. **Any executable edit, restored revision, or permission change disables the extension and requires fresh approval.** Exported and restored packages also come back disabled; re-importing a byte-identical package keeps its approval, while changed executable content clears it.

**Updating = re-importing under the same name.** Marinara asks to replace the saved code ("…The extension will be disabled and require approval of its new hash"), and a lower numeric dotted `config.version` triggers an **Import Older Revision?** downgrade warning. There is **no URL installer, remote catalog or auto-updater** — every update of a distributed extension is a manual re-import plus fresh hash approval by each recipient. Deleting removes the record and its private settings, so export first.

When advising: the default workflow is *ask Mari → read the code → approve the hash → enable*. For self-written code: *open both external gates → write a manifest + JS → **Import Extension Folder** (or **Import Extension File** for a ZIP/JSON/JS) under **External Extensions** → read → approve the hash*. Never tell a user to paste code into a New Draft box; there isn't one.

### Writing one by hand (manifest)

A folder (or ZIP) with a `manifest.json` plus source files — the shape of `docs/examples/personal-extensions/browser-minimal/`:

```json
{
  "kind": "marinara.personal-extension",
  "version": 1,
  "config": {
    "name": "Hello Panel",
    "version": "1.0.0",
    "description": "A minimal sandboxed Browser Extension.",
    "runtime": "client",
    "capabilities": [],
    "jsPath": "extension.js",
    "cssPath": "extension.css"
  }
}
```

A Server Extension uses `"kind": "marinara.personal-server-extension"`, `"runtime": "server"`, `"capabilities": []` and `serverJsPath`. Paths may be ordered arrays; `js` / `serverJs` / `css` inline the source instead. **Plain JavaScript only** — Marinara compiles no TypeScript and installs no dependencies (bundle first); top-level `await` works. Loose `.js`/`.mjs`/`.cjs`, `.server.js`/`.server.mjs`/`.server.cjs` and `.css` files also import, but a manifest records identity, runtime, capabilities and file order explicitly. Importing or managing extensions from a phone, LAN address or remote browser needs `ADMIN_SECRET` on the server and the same value under **Settings → Advanced → Admin Access**.

### What the sandbox actually is

A Browser Extension runs in a dedicated **Worker inside an opaque-origin sandboxed iframe** (`sandbox="allow-scripts"`, no `allow-same-origin`), under a narrow CSP with no connections, forms, objects, or navigation authority. Network and nested-worker globals are removed as defense in depth. A heartbeat watchdog terminates an unresponsive or busy-looping worker.

**It cannot reach** Marinara's page, DOM, cookies, browser storage, origin APIs, or the network.

**It gets exactly:**

| Capability | API |
|---|---|
| Identity | `marinara.runtime` (`"client"`), `.version` (`5`), `.extensionId`, `.extensionName`, `.capabilities` |
| Private per-extension storage (brokered by the parent; ≤1,000,000 bytes of JSON) | `marinara.storage.get()` / `.patch(obj)` / `.delete()` |
| Namespaced logging | `marinara.log.debug/info/warn/error(...)` |
| Managed timers (removed when the extension stops) | `marinara.setTimeout` / `setInterval` / `clearTimeout` / `clearInterval` |
| Cleanup registration | `marinara.onCleanup(fn)` |
| Token estimate **(v2.5.0, #6257)** — sync, no capability, model-agnostic; also on Full page and Server | `marinara.estimateTextTokens(text)` — feature-detect with `typeof marinara.estimateTextTokens === "function"` on older Engines |
| Read-only active chat / character IDs | `marinara.context.get()` / `.subscribe(fn)` |
| Bounded card fields — **only with approved permissions** | same context snapshot |
| A constrained temporary window | `marinara.ui.showWindow({...})` |
| Host-rendered contribution slots | `marinara.ui.registerContribution({...})` |

There is **no DOM helper, no `apiFetch`, no parent event access, and no arbitrary network capability.** The old pre-2.3.4 `marinara` API (`addStyle`, `addElement`, `apiFetch`) is gone from the safe runtime — designs that assumed it must be redesigned or must use Full page access.

### UI contributions (the main surface, 2.3.5+)

`marinara.ui.registerContribution({ id, kind, label, description?, icon?, surface?, position?, elements?, onActivate?, onEvent? })` returns a frozen handle with `update(patch)` and `remove()`. Three fixed locations:

- **`button`** — compact top-bar action on larger screens, plus an Extensions-menu action everywhere
- **`menu-item`** — Extensions-menu action only
- **`panel`** — opens Marinara's trusted Extensions side panel

**Button surfaces (by v2.5.0):** a `button` may add `surface` — default `"top-bar"`, or `chats`, `bots`, `characters`, `personas`, `lorebooks`, `presets`, `connections`, `agents`, `settings` — and, off the top bar, `position`: `"header"` (default), `"before-content"` or `"after-content"`. Only buttons accept these; a top-bar button with a `position` is rejected. `icon` is any kebab-case Lucide name (≤64 chars; unknown names fall back to the puzzle icon) — earlier versions allowed a fixed list of 15. `update(patch)` is kind-specific: button → label/description/icon/surface/position; menu-item → label/description/icon; panel → those plus `elements`.

Panel/window elements come from a **fixed vocabulary only**: `heading`, `text`, `pre`, `button`, `input`, `select`, `toggle`, `slider`, `color`, `spacer`. Interactive controls need unique IDs (letters, numbers, `.`, `_`, `-`). `heading`/`text`/`pre` need **non-empty** `text` — one invalid element makes the host reject the whole contribution. Caps: 24 contributions per extension, 60 panel elements, 80-char labels, 8,000 chars per text, 32,000 chars of panel text, 100 select options (each option's value and label ≤80), ids and icon names ≤64, descriptions and input placeholders ≤240; `showWindow` allows at most **4** open windows. The client drops the *whole* contribution on any breach.

A panel button posts `{ contributionId, elementId, values }` to `onEvent`, where `values` holds the current string value of every control (toggles arrive as `"true"`/`"false"`). `onActivate` fires when the user opens or invokes the contribution.

**The extension supplies content and state — never HTML, CSS, URLs, React components, or host event handlers.** The client independently validates every descriptor; kinds, surfaces, positions, icon-name syntax, controls, IDs, option lists, text lengths, element counts, and per-extension contribution counts are validated and capped. React renders extension text *as text*.

```js
const panel = marinara.ui.registerContribution({
  id: "weather-settings",
  kind: "panel",
  label: "Weather controls",
  icon: "sparkles",
  elements: [
    { kind: "heading", text: "Atmosphere" },
    { kind: "select", id: "weather", label: "Weather", value: "rain",
      options: [{ value: "rain", label: "Rain" }, { value: "snow", label: "Snow" }] },
    { kind: "slider", id: "intensity", label: "Intensity", min: 0, max: 100, value: 60 },
    { kind: "toggle", id: "lightning", label: "Lightning", checked: false },
    { kind: "button", id: "apply", label: "Apply" },
  ],
  onActivate: async () => { const s = await marinara.storage.get(); /* reflect state */ },
  onEvent: async ({ elementId, values }) => {
    if (elementId !== "apply") return;
    await marinara.storage.patch(values);
  },
});
marinara.onCleanup(() => panel.remove());
```

Multi-step interfaces work by calling `handle.update({ elements })` after an event. **Keep state in `marinara.storage`, not encoded in markup.**

`marinara.ui.showWindow({ title, elements, onEvent, onClose })` still exists for a temporary window (same control set, returns `update(...)` / `close()`). Prefer contributions when the tool should be reachable through normal navigation.

### Context API — version 5 (v2.4.0; still 5 at v2.5.0)

```ts
{
  chatId: string | null;
  characterId: string | null;          // null in group chats
  characterIds: readonly string[];     // every participant
  personaId: string | null;            // requires read_active_persona
  characters: readonly CharacterSnapshot[];  // requires read_active_characters
  persona: PersonaSnapshot | null;           // requires read_active_persona
}
```

`marinara.context.get()` returns the current snapshot; `marinara.context.subscribe(fn)` pushes updates when the active chat, its character list, or its selected persona changes. With no active chat (Home, a library), `chatId` is `null` and `characterIds` is empty.

**IDs are always available with no permission** — that's what makes per-chat and per-character private storage namespacing possible without granting data access.

Record *fields* require declared capabilities in the manifest:

```json
{ "runtime": "client", "capabilities": ["read_active_characters", "read_active_persona"] }
```

- `read_active_characters` → `characters` populated for cards in the active chat
- `read_active_persona` → `persona` populated for the chat's selected persona

Without the permission the value stays `[]` or `null`. Requested permissions appear in **Requested access** and again in the exact-hash approval dialog. **Adding or removing a permission changes the hash, disables the extension, and requires fresh approval.**

Character snapshots are bounded to: `id`, `name`, `description`, `personality`, `scenario`, `firstMessage`, `exampleDialogue`, `creator`, `characterVersion`, `tags`, `backstory`, `appearance`, `aboutMe`, `conversationDisplayName`. Persona snapshots: `id`, `source` (optional: `"persona"`, or `"character"` when a character card is being used as the persona), `name`, `description`, `personality`, `scenario`, `backstory`, `appearance`, `tags`, `aboutMe`, `conversationDisplayName`.

**Never delivered, under any permission:** messages, creator notes, system prompts, post-history instructions, comments, avatar paths, full character/persona libraries, undeclared fields, chat metadata, database handles, network access, or any mutation operation.

Enforcement is layered — server derives and bounds the set, the iframe accepts context only from its parent and only on a matching `contentHash`, and the Worker independently drops undeclared records, rejects character records not in `characterIds`, re-bounds, and freezes.

### The hard limit (say this out loud when scoping)

> UI contributions provide the interface, not ambient authority.

Features needing **messages, presets, lorebooks, undeclared card data, or visual scene effects** require a **separate, narrowly scoped broker capability exposed by Marinara** — i.e. an engine PR (Mode B). An extension must not simulate one through host DOM access or unrestricted network requests. Scope extension ideas against this before promising anything.

### Full page access (the escape hatch — 2.4.0)

```json
{ "runtime": "client", "capabilities": ["full_page_access"] }
```

**This is not a sandbox capability.** The approved JS and CSS run *inside Marinara's page*, with the same practical authority as code pasted into the browser console: read/change anything in the session, inspect chats and cards, use browser storage, make network requests, call same-origin `/api` routes.

Constraints:
- **External Extensions only** — Professor Mari drafts cannot request it.
- Both external gates plus exact-hash approval, with a dedicated high-risk disclosure.
- Any code, CSS, or permission change disables it and requires fresh approval.
- Cleanup is **best effort** — page code can create unregistered listeners, timers, globals, and DOM changes. Tell users to reload the page after disabling one.
- The code runs in an async function with a small compatibility `marinara` object (identity, logging, private storage, managed timers, `onCleanup`). **(v2.4.2, #4720)** Use `marinara.fetch(...)` — same signature and result as `window.fetch` — so **External Extensions** can show that extension's request count, transferred bytes, recent rate and a sustained-traffic warning; raw `window.fetch` still works but isn't attributed.

**Legacy classification:** a `kind: "marinara.extension"` v1 envelope *with no explicit `capabilities` field* is treated as pre-sandbox and assigned **Full page access** at import — so legacy packages like WeatherTweaker reach the review flow instead of silently failing in the Worker. A modern package using that envelope but wanting the safe runtime must include `"capabilities": []`. Modern exports always write the field (even empty), so safe packages aren't reclassified on re-import.

### Server Extensions

A separate permission-restricted Node process under **macOS Seatbelt or Linux Bubblewrap**, with a minimal environment, Node permissions, private protocol files, and resource/message bounds. No access to Marinara files, user files, inherited server secrets, network, child processes, workers, native addons, or cross-process signals.

Server code gets `marinara.runtime`/`version`, identity, `log`, `storage`, managed timers, `onCleanup` and `estimateTextTokens` — no filesystem, process, network, module loading or database. Its manifest must declare `"capabilities": []`. **(v2.4.4, #5514)** After the host resumes from a system-wide pause, the sandbox gets a fresh heartbeat window, so a late watchdog tick no longer kills a healthy extension; storage writes registered through `onCleanup` finish during a polite stop (v2.4.2).

**Unsupported platforms fail closed — Marinara never runs them unsandboxed.**

| Platform | Sandboxed Browser | Full page External | Server |
|---|---|---|---|
| macOS | ✅ | ⚠️ explicit trust | ✅ Seatbelt |
| Linux + `bwrap` | ✅ | ⚠️ explicit trust | ✅ Bubblewrap |
| Linux, no `bwrap` | ✅ | ⚠️ explicit trust | ⛔ install `bwrap` |
| **Docker (default)** | ✅ | ⚠️ explicit trust | ⛔ container can't create Bubblewrap's namespaces (override + tradeoff: `docs/TROUBLESHOOTING.md`) |
| **Windows** | ✅ | ⚠️ explicit trust | ⛔ **unavailable by design** |
| **Android** | ✅ | ⚠️ explicit trust | ⛔ **unavailable by design** |

**Check the user's OS (and whether it's the default Docker image) before recommending a Server Extension.** On Windows/Android, use a Browser Extension or move the server to macOS/Linux.

### External Extensions (third-party and hand-written imports)

Every source other than a Professor Mari draft — third-party packages, your own hand-written code, legacy and profile-imported records — is an External Extension. Locked and hidden behind **two independent gates**:

1. On the host: `ENABLE_EXTERNAL_EXTENSIONS=true` in `.env`
2. In app: **Settings > Advanced > Danger Zone** → below the data-deletion controls → enable **Allow third-party extension imports**

Only then does **Settings > Addons** show **External Extensions** with **Import Extension File** and **Import Extension Folder** (`docs/extending/writing-personal-extensions.md` still says "Import Folder" — the UI wins). Supported formats: `.personal-extension.zip` and compatible `.zip`, `.json` manifests, `.css`, `.js`/`.mjs`/`.cjs`, `.server.js`/`.server.mjs`/`.server.cjs`. From a non-localhost browser, import and management also need **Admin Access** (see the manifest section above).

Imports **never carry approval and cannot enable themselves.** Legacy, profile-imported, manually stored, and unknown-source records are all treated as external — hidden, unapprovable, and excluded from both runtimes until both gates open. Closing either gate stops external server processes, removes browser workers and full page nodes, and disables the records; reopening does **not** auto-restart them.

Third-party extension code is untrusted. Always tell users to read every line before importing or enabling.

### Payload shape and approval fields

From `packages/shared/src/schemas/personal-extension.schema.ts` — useful when the manifest snippets above need to be exact rather than illustrative (in a package manifest these sit under `config`):

| Field | Notes |
|---|---|
| `runtime` | `"client"` (default) or `"server"` |
| `js` | Browser JavaScript (manifest: inline `js` or `jsPath`). There is no `code` field. A Browser Extension needs JS or CSS. |
| `css` | Stylesheet, ≤256 KiB — in the safe runtime it styles only the sandboxed `showWindow` iframe; for Full page access it applies to the page |
| `serverJs` | Server code — **required when `runtime === "server"`**; a server extension with an empty `serverJs` fails validation on that path |
| `capabilities` | Declared permissions; include `[]` explicitly to stay in the safe runtime. Server Extensions must use `[]` |
| `name`, `version`, `description` | 1–200 chars / ≤64 / ≤2,000 |
| `contentHash`, `approvedHash`, `enabled`, `source` | Stored-record fields, not package fields: the `sha256:` fingerprint approval binds to, the approved hash, state, and origin (`professor_mari` vs external) |

**Size limits (v2.4.3, #5025 removed the shared 1 MiB JavaScript cap):** no per-field JS limit; an imported ZIP is capped at 32 MiB compressed, 2 MiB per text entry and 16 MiB of extracted text; private storage at 1,000,000 bytes.

Approval carries **two** acknowledgement literals, which is how the two-tier disclosure is enforced rather than merely displayed:

- **`acknowledgeSandboxedCode: z.literal(true)`** — a required literal on *every* approval; the schema refuses anything else.
- **`acknowledgeFullPageAccess: z.literal(true).optional()`** — optional in the schema, but the approve route refuses a Full page access package without it (HTTP 400 "Full page access must be explicitly acknowledged.").

So neither can be defaulted or skipped programmatically — one by the schema, the other by the route.

### Recovery

If an extension misbehaves: **Disable**. If the UI is unavailable, stop Marinara and set the relevant `installed_extensions` record's `enabled` to `"false"`. **Never set `approvedHash` by hand.**

Rollback restores a prior revision (up to ten are kept) — as a **disabled** draft requiring fresh approval. Restoring a profile or backup also leaves every extension disabled until reviewed (profile-import quarantine, v2.4.2). **Export** lives in the extension's editor (v2.4.2 — cards now show only power and delete) and never carries approval.

---

## Advising checklist

Before promising an extension can do something, walk this:

1. **Does it need data beyond IDs + bounded active card/persona fields?** → Not possible in the sandbox. Broker capability (engine PR) or Full page access.
2. **Does it need custom visual output?** → Only the fixed control vocabulary. No HTML/CSS/React. If they want real visual styling, that's a **theme**, possibly alongside an extension for behavior.
3. **Does it need network access?** → Not in the sandbox. A **webhook custom tool** is usually the right answer instead (see `custom-tools.md`).
4. **Is it a Server Extension on Windows/Android (or the default Docker container)?** → Won't run. Redirect.
5. **Is it something to distribute?** → The recipient needs both external gates open and must approve the hash — the same as for code they hand-write themselves — and every update means re-importing under the same name and re-approving (no auto-updater). An official agent package or custom GitHub agent repo is a smoother distribution path (see `agents.md`).
6. **Is it really an extension at all?** → Per-turn automation is an **agent**; model-invoked actions are a **custom tool**; text transforms are **regex scripts**; pure styling is a **theme** (or a native Appearance setting); tabletop mechanics for Game Mode are a **ruleset** — JSON data, no code (see `rulesets.md`). A simple card on Home can be a **custom Home widget**: Professor Mari proposes a safe, data-only widget for explicit confirmation, managed in **Home Widgets** under **Personal** (v2.4.2, #4801) — no code to review. Extensions are for user-invoked UI surfaces and private per-chat state.

## Related references

- `agents.md` — per-turn automation, official packages, custom GitHub agent repos, agent Home widgets
- `custom-tools.md` — model-invoked actions, webhooks, script sandbox, regex scripts
- `rulesets.md` — Game Mode rulesets (tabletop mechanics as JSON data; authoring, import, Capability API gates)
- `decision-guide.md` — full "which surface?" hierarchy
- Engine docs: `docs/extending/personal-extensions.md` (user), `docs/extending/writing-personal-extensions.md` (hand-authoring guide + manifest/API reference), `docs/examples/personal-extensions/` (importable Browser/Server examples), `docs/development/personal-extensions.md` (developer/architecture), `docs/appearance/custom-css-themes.md` (theme hooks)
