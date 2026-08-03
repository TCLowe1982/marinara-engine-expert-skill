/**
 * Personal Extension starter — sandboxed Browser Extension (Marinara Engine v2.3.5+)
 *
 * HOW THIS GETS INSTALLED
 *   You do not paste this into Marinara. There is no "New Draft" button and no
 *   import control in Settings > Addons > Personal Extensions. Ask Professor
 *   Mari to create the extension; she saves the draft. Then YOU open it, read
 *   the code, compare the displayed SHA-256 hash, and click "Review and Run".
 *   Any executable edit or permission change disables it and requires fresh
 *   approval. Mari cannot approve or enable anything.
 *
 * WHAT THE SANDBOX GIVES YOU
 *   Private storage, logging, managed timers, cleanup registration, the fixed
 *   UI control set below, and a read-only snapshot of active chat/character IDs.
 *
 * WHAT IT DOES NOT — do not design around these
 *   No messages, no presets, no lorebooks, no undeclared card fields, no chat
 *   metadata, no DOM, no database, no network, no mutation of anything.
 *   Those need a broker capability in the engine (an upstream PR), or the
 *   un-sandboxed Full page access path (External Extensions only, double-gated,
 *   Mari cannot author it).
 *
 * MANIFEST — keep `capabilities` present even when empty. A legacy
 * `kind: "marinara.extension"` envelope with NO capabilities field is
 * classified as Full page access on import.
 *
 *   { "runtime": "client", "capabilities": [] }
 *
 * Optional, each shown in "Requested access" and in the approval dialog:
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
//    kind: "button"    -> top-bar action on wide screens + Extensions menu
//    kind: "menu-item" -> Extensions menu only
// ---------------------------------------------------------------------------
const panel = marinara.ui.registerContribution({
  id: "scene-notes",
  kind: "panel",
  label: "Scene notes",
  description: "Per-chat scratch notes that persist across sessions.",
  icon: "sparkles",
  elements: [
    { kind: "heading", text: "Notes for this chat" },
    { kind: "input", id: "note", label: "Note", value: "" },
    { kind: "toggle", id: "pinned", label: "Pin to top", checked: false },
    { kind: "button", id: "save", label: "Save" },
    { kind: "spacer" },
    { kind: "pre", id: "saved", text: "" },
  ],

  // Fires when the user opens the panel. Reflect stored state into controls.
  onActivate: async () => {
    const store = await marinara.storage.get();
    const chatId = marinara.context.get().chatId;
    const entry = chatId ? store.byChat?.[chatId] : null;
    panel.update({
      elements: [
        { kind: "heading", text: "Notes for this chat" },
        { kind: "input", id: "note", label: "Note", value: entry?.note ?? "" },
        { kind: "toggle", id: "pinned", label: "Pin to top", checked: !!entry?.pinned },
        { kind: "button", id: "save", label: "Save" },
        { kind: "spacer" },
        { kind: "pre", id: "saved", text: entry ? `Saved: ${entry.note}` : "No note yet." },
      ],
    });
  },

  // A panel button posts { contributionId, elementId, values }.
  // `values` carries the current value of EVERY control in the panel.
  onEvent: async ({ elementId, values }) => {
    if (elementId !== "save") return;

    const chatId = marinara.context.get().chatId;
    if (!chatId) return; // Home or a library — no active chat to key against.

    const store = await marinara.storage.get();
    await marinara.storage.patch({
      byChat: {
        ...(store.byChat ?? {}),
        [chatId]: { note: values.note, pinned: values.pinned === "true" },
      },
    });

    panel.update({ elements: [{ kind: "pre", id: "saved", text: `Saved: ${values.note}` }] });
  },
});

// ---------------------------------------------------------------------------
// 2. Context API v5. IDs need NO permission — that is what makes per-chat and
//    per-character private storage possible without granting data access.
//    Card FIELDS require the capabilities above.
// ---------------------------------------------------------------------------
const unsubscribe = marinara.context.subscribe(
  ({ chatId, characterId, characterIds, personaId, characters, persona }) => {
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
  },
);

// ---------------------------------------------------------------------------
// 3. Always register cleanup. Timers created through the API are managed, but
//    contributions and subscriptions are yours to remove.
// ---------------------------------------------------------------------------
marinara.onCleanup(() => {
  unsubscribe();
  panel.remove();
});
