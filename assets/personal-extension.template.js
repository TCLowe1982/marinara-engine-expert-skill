/**
 * Personal Extension starter — sandboxed Browser Extension
 * (Marinara Engine v2.3.5+; checked against v2.5.0, Browser API version 5)
 *
 * HOW THIS GETS INSTALLED — two paths
 *   1. Professor Mari (default, no gates). There is no "New Draft" button and
 *      no import control in Settings > Addons > Personal Extensions. Ask Mari
 *      to create the extension; she saves a disabled draft. Mari cannot
 *      approve or enable anything, and cannot request Full page access.
 *   2. Hand-written (v2.4.3+). Code you write yourself is imported as an
 *      EXTERNAL Extension, so both gates must be open:
 *        - host .env:  ENABLE_EXTERNAL_EXTENSIONS=true
 *        - Settings > Advanced > Danger Zone > "Allow third-party extension imports"
 *      Put this file next to a manifest.json (below), then
 *      Settings > Addons > External Extensions > Import Extension Folder
 *      (or Import Extension File for a ZIP). To update later, re-import under
 *      the same name: it is disabled until you approve the new hash.
 *      From a phone/LAN/remote browser you also need ADMIN_SECRET on the
 *      server and the same value under Settings > Advanced > Admin Access.
 *      Guide: docs/extending/writing-personal-extensions.md
 *      Examples: docs/examples/personal-extensions/browser-minimal/
 *
 *   Either way: open the draft, read the code, compare the displayed SHA-256
 *   hash, then click "Review and Run". Any executable edit or permission
 *   change disables it and requires fresh approval.
 *
 * WHAT THE SANDBOX GIVES YOU
 *   Private storage (get/patch/delete, <= 1,000,000 bytes of JSON), logging
 *   (log.debug/info/warn/error), managed timers (marinara.setTimeout etc.),
 *   cleanup registration, the fixed UI control set below, a read-only
 *   snapshot of active chat/character IDs, and (v2.5.0) a token estimator.
 *
 * WHAT IT DOES NOT — do not design around these
 *   No messages, no presets, no lorebooks, no undeclared card fields, no chat
 *   metadata, no DOM, no database, no network, no mutation of anything.
 *   Those need a broker capability in the engine (an upstream PR), or the
 *   un-sandboxed Full page access path (External Extensions only, double-gated,
 *   Mari cannot author it).
 *
 * MANIFEST (manifest.json, for the hand-written path). Plain JavaScript only:
 * no TypeScript compile, no dependency install (bundle first). Top-level
 * await is fine.
 *
 *   {
 *     "kind": "marinara.personal-extension",
 *     "version": 1,
 *     "config": {
 *       "name": "Scene Notes",
 *       "version": "1.0.0",
 *       "description": "Per-chat scratch notes.",
 *       "runtime": "client",
 *       "capabilities": [],
 *       "jsPath": "extension.js"
 *     }
 *   }
 *
 * Keep `capabilities` present even when empty: a legacy
 * `kind: "marinara.extension"` envelope with NO capabilities field is
 * classified as Full page access on import.
 *
 * Optional capabilities, each shown in "Requested access" and in the approval
 * dialog:
 *   "read_active_characters" -> populates `characters` in the context snapshot
 *   "read_active_persona"    -> populates `persona` and `personaId`
 * Adding or removing one changes the hash and forces re-approval.
 */

// ---------------------------------------------------------------------------
// 1. A panel. Elements come from a FIXED vocabulary — heading, text, pre,
//    button, input, select, toggle, slider, color, spacer. No HTML, no CSS,
//    no URLs, no React. You supply content and state; Marinara renders it in
//    the active theme.
//
//    kind: "panel"     -> opens Marinara's Extensions side panel
//    kind: "button"    -> top-bar action on wide screens + Extensions menu.
//                         Can instead target a host surface with
//                         surface: "chats" | "bots" | "characters" | "personas"
//                         | "lorebooks" | "presets" | "connections" | "agents"
//                         | "settings", plus position: "header" (default)
//                         | "before-content" | "after-content".
//    kind: "menu-item" -> Extensions menu only
//
//    The host rejects the WHOLE contribution if any element is invalid —
//    e.g. a heading/text/pre with empty `text`. Always send non-empty text.
//    update({ elements }) REPLACES the element list, so rebuild all of it.
// ---------------------------------------------------------------------------

// Model-agnostic token estimate (v2.5.0). Feature-detect for older Engines.
const estimateTokens = (text) =>
  typeof marinara.estimateTextTokens === "function" ? marinara.estimateTextTokens(text) : null;

const renderElements = (entry) => {
  const tokens = entry?.note ? estimateTokens(entry.note) : null;
  return [
    { kind: "heading", text: "Notes for this chat" },
    { kind: "input", id: "note", label: "Note", value: entry?.note ?? "", multiline: true },
    { kind: "toggle", id: "pinned", label: "Pin to top", checked: !!entry?.pinned },
    { kind: "button", id: "save", label: "Save" },
    { kind: "spacer" },
    {
      kind: "pre",
      text: entry?.note
        ? `Saved: ${entry.note}${tokens === null ? "" : `\n(~${tokens} tokens)`}`
        : "No note yet.",
    },
  ];
};

const readEntry = async () => {
  const chatId = marinara.context.get().chatId;
  if (!chatId) return null; // Home or a library — no active chat to key against.
  const store = await marinara.storage.get();
  return store.byChat?.[chatId] ?? null;
};

const panel = marinara.ui.registerContribution({
  id: "scene-notes",
  kind: "panel",
  label: "Scene notes",
  description: "Per-chat scratch notes that persist across sessions.",
  icon: "notebook-pen", // any kebab-case Lucide name; unknown names fall back to "puzzle"
  elements: renderElements(null),

  // Fires when the user opens the panel. Reflect stored state into controls.
  onActivate: async () => {
    panel.update({ elements: renderElements(await readEntry()) });
  },

  // A panel button posts { contributionId, elementId, values }.
  // `values` carries the current STRING value of every control
  // (toggles arrive as "true" / "false").
  onEvent: async ({ elementId, values }) => {
    if (elementId !== "save") return;

    const chatId = marinara.context.get().chatId;
    if (!chatId) return;

    const store = await marinara.storage.get();
    const entry = { note: values.note ?? "", pinned: values.pinned === "true" };
    await marinara.storage.patch({ byChat: { ...(store.byChat ?? {}), [chatId]: entry } });

    panel.update({ elements: renderElements(entry) });
  },
});

// ---------------------------------------------------------------------------
// 2. Context API v5. IDs need NO permission — that is what makes per-chat and
//    per-character private storage possible without granting data access.
//    Card FIELDS require the capabilities above.
// ---------------------------------------------------------------------------
const unsubscribe = marinara.context.subscribe(
  async ({ chatId, characterId, characterIds, personaId, characters, persona }) => {
    // chatId is null on Home / a library / anywhere without an active chat.
    // characterId is populated ONLY in a single-character chat; group chats
    // leave it null and list every participant in characterIds.
    if (!chatId) return;

    marinara.log.debug("context", {
      chatId,
      characterId,
      participants: characterIds.length,
      // [] unless read_active_characters is approved:
      names: characters.map((c) => c.name),
      // null unless read_active_persona is approved:
      persona: persona?.name ?? null,
      personaId,
    });

    // Keep the panel in step when the user switches chats.
    panel.update({ elements: renderElements(await readEntry()) });
  },
);

// ---------------------------------------------------------------------------
// 3. Always register cleanup. Timers created through marinara.setTimeout /
//    setInterval are managed, but contributions and subscriptions are yours
//    to remove.
// ---------------------------------------------------------------------------
marinara.onCleanup(() => {
  unsubscribe();
  panel.remove();
});
