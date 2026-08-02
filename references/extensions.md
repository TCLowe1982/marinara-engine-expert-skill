# Themes and Personal Extensions

> **⚠️ If you remember "extensions were removed from Marinara," that is stale.** They *were* removed in v2.3.4 — and **reintroduced in v2.3.5 as sandboxed Personal Extensions**, then expanded in v2.4.0 (Browser Extension API v5, UI contribution slots, Full page access compatibility mode). The removal is history. Answer from this file, not from memory.
>
> The 2.3.4 data loss is still real for anyone upgrading across it: extension code and `marinara.storage` bags from the pre-2.3.4 era were permanently erased on first 2.3.4 startup and are **not** restored by 2.3.5. Recovery requires a pre-2.3.4 database backup or an old zip export. The new system starts empty.

Marinara has two distinct user-side customization surfaces under **Settings > Addons**: **themes** (styling) and **Personal Extensions** (behavior). Both are ideation work — neither goes through the PR process.

---

## Part 1: Themes (styling)

For look-and-feel only. Themes are server-synced custom CSS installed under **Settings > Addons**, alongside the native **Settings > Appearance** controls (accent/chroma, dialogue colors, text scale, chat backgrounds).

Reach for a theme when the ask is purely visual. Reach for native Appearance settings first when the ask is covered there — accent color, dialogue color, and text scaling no longer need custom CSS. Note that as of 2.3.5, **Default Dialogue Color** is permanently active for cards without their own color (its Appearance toggle was removed), and card-level colors still win.

Themes cannot add behavior, read data, or run JavaScript. That's what extensions are for.

---

## Part 2: Personal Extensions (behavior)

**Settings > Addons > Personal Extensions.** The default empty-state message:

> Ask Professor Mari to create an extension for you. Nothing runs until you enable it and approve the exact code hash.

### The authorship model (this trips people up)

There is **no "New Draft" button and no import control** in the Personal Extensions section. The only author is **Professor Mari** — the user asks her to create or revise a draft. She can write and save code; **she cannot approve or enable it, and she cannot request Full page access.**

Every draft starts **disabled**. Marinara fingerprints the exact executable code with **SHA-256**. The user opens the draft, reads the code, compares the displayed hash, and clicks **Review and Run** only if they accept that exact version. **Any executable edit, restored revision, or permission change disables the extension and requires fresh approval.** Exported and restored packages also come back disabled.

When advising: the correct workflow is always *ask Mari → read the code → approve the hash → enable*. Never tell a user to paste code into a New Draft box; there isn't one.

### What the sandbox actually is

A Browser Extension runs in a dedicated **Worker inside an opaque-origin sandboxed iframe** (`sandbox="allow-scripts"`, no `allow-same-origin`), under a narrow CSP with no connections, forms, objects, or navigation authority. Network and nested-worker globals are removed as defense in depth. A heartbeat watchdog terminates an unresponsive or busy-looping worker.

**It cannot reach** Marinara's page, DOM, cookies, browser storage, origin APIs, or the network.

**It gets exactly:**

| Capability | API |
|---|---|
| Private per-extension storage (brokered by the parent) | `marinara.storage.get()` / `.patch()` |
| Namespaced logging | `marinara.log.debug(...)` |
| Managed timers | (auto-cleaned) |
| Cleanup registration | `marinara.onCleanup(fn)` |
| Read-only active chat / character IDs | `marinara.context.get()` / `.subscribe(fn)` |
| Bounded card fields — **only with approved permissions** | same context snapshot |
| A constrained temporary window | `marinara.ui.showWindow({...})` |
| Host-rendered contribution slots | `marinara.ui.registerContribution({...})` |

There is **no DOM helper, no `apiFetch`, no parent event access, and no arbitrary network capability.** The old pre-2.3.4 `marinara` API (`addStyle`, `addElement`, `apiFetch`) is gone from the safe runtime — designs that assumed it must be redesigned or must use Full page access.

### UI contributions (the main surface, 2.3.5+)

`marinara.ui.registerContribution({ id, kind, label, description?, icon?, elements?, onActivate?, onEvent? })` returns a frozen handle with `update(patch)` and `remove()`. Three fixed locations:

- **`button`** — compact top-bar action on larger screens, plus an Extensions-menu action everywhere
- **`menu-item`** — Extensions-menu action only
- **`panel`** — opens Marinara's trusted Extensions side panel

Panel/window elements come from a **fixed vocabulary only**: `heading`, `text`, `pre`, `button`, `input`, `select`, `toggle`, `slider`, `color`, `spacer`. Interactive controls need unique IDs (letters, numbers, `.`, `_`, `-`).

A panel button posts `{ contributionId, elementId, values }` to `onEvent`, where `values` holds the current string value of every control. `onActivate` fires when the user opens or invokes the contribution.

**The extension supplies content and state — never HTML, CSS, URLs, React components, or host event handlers.** The client independently validates every descriptor; kinds, icons, controls, IDs, option lists, text lengths, element counts, and per-extension contribution counts are allowlisted and capped. React renders extension text *as text*.

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

### Context API — version 5 (v2.4.0)

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

Character snapshots are bounded to: `id`, `name`, `description`, `personality`, `scenario`, `firstMessage`, `exampleDialogue`, `creator`, `characterVersion`, `tags`, `backstory`, `appearance`, `aboutMe`, `conversationDisplayName`. Persona snapshots: `id`, `name`, `description`, `personality`, `scenario`, `backstory`, `appearance`, `tags`, `aboutMe`, `conversationDisplayName`.

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

**Legacy classification:** a `kind: "marinara.extension"` v1 envelope *with no explicit `capabilities` field* is treated as pre-sandbox and assigned **Full page access** at import — so legacy packages like WeatherTweaker reach the review flow instead of silently failing in the Worker. A modern package using that envelope but wanting the safe runtime must include `"capabilities": []`. Modern exports always write the field (even empty), so safe packages aren't reclassified on re-import.

### Server Extensions

A separate permission-restricted Node process under **macOS Seatbelt or Linux Bubblewrap**, with a minimal environment, Node permissions, private protocol files, and resource/message bounds. No access to Marinara files, user files, inherited server secrets, network, child processes, workers, native addons, or cross-process signals.

**Unsupported platforms fail closed — Marinara never runs them unsandboxed.**

| Platform | Sandboxed Browser | Full page External | Server |
|---|---|---|---|
| macOS | ✅ | ⚠️ explicit trust | ✅ Seatbelt |
| Linux + `bwrap` | ✅ | ⚠️ explicit trust | ✅ Bubblewrap |
| Linux, no `bwrap` | ✅ | ⚠️ explicit trust | ⛔ install `bwrap` |
| **Windows** | ✅ | ⚠️ explicit trust | ⛔ **unavailable by design** |
| **Android** | ✅ | ⚠️ explicit trust | ⛔ **unavailable by design** |

**Check the user's OS before recommending a Server Extension.** On Windows/Android, use a Browser Extension or move the server to macOS/Linux.

### External Extensions (third-party imports)

Locked and hidden behind **two independent gates**:

1. On the host: `ENABLE_EXTERNAL_EXTENSIONS=true` in `.env`
2. In app: **Settings > Advanced > Danger Zone** → below the data-deletion controls → enable **Allow third-party extension imports**

Only then does **Settings > Addons** show **External Extensions** with file/folder import. Supported formats: `.personal-extension.zip` and compatible `.zip`, `.json` manifests, `.css`, `.js`/`.mjs`/`.cjs`, `.server.js`/`.server.mjs`/`.server.cjs`.

Imports **never carry approval and cannot enable themselves.** Legacy, profile-imported, manually stored, and unknown-source records are all treated as external — hidden, unapprovable, and excluded from both runtimes until both gates open. Closing either gate stops external server processes, removes browser workers and full page nodes, and disables the records; reopening does **not** auto-restart them.

Third-party extension code is untrusted. Always tell users to read every line before importing or enabling.

### Recovery

If an extension misbehaves: **Disable**. If the UI is unavailable, stop Marinara and set the relevant `installed_extensions` record's `enabled` to `"false"`. **Never set `approvedHash` by hand.**

Rollback restores a prior revision — as a **disabled** draft requiring fresh approval.

---

## Advising checklist

Before promising an extension can do something, walk this:

1. **Does it need data beyond IDs + bounded active card/persona fields?** → Not possible in the sandbox. Broker capability (engine PR) or Full page access.
2. **Does it need custom visual output?** → Only the fixed control vocabulary. No HTML/CSS/React. If they want real visual styling, that's a **theme**, possibly alongside an extension for behavior.
3. **Does it need network access?** → Not in the sandbox. A **webhook custom tool** is usually the right answer instead (see `custom-tools.md`).
4. **Is it a Server Extension on Windows/Android?** → Won't run. Redirect.
5. **Is it something to distribute?** → The recipient needs both external gates open and must approve the hash. An official agent package or custom GitHub agent repo is a smoother distribution path (see `agents.md`).
6. **Is it really an extension at all?** → Per-turn automation is an **agent**; model-invoked actions are a **custom tool**; text transforms are **regex scripts**; pure styling is a **theme**. Extensions are for user-invoked UI surfaces and private per-chat state.

## Related references

- `agents.md` — per-turn automation, official packages, custom GitHub agent repos
- `custom-tools.md` — model-invoked actions, webhooks, script sandbox, regex scripts
- `decision-guide.md` — full "which surface?" hierarchy
- Engine docs: `docs/extending/personal-extensions.md` (user), `docs/development/personal-extensions.md` (developer/API)
