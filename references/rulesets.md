# Game Mode Rulesets

> **New surface in v2.5.0.** If you remember Game Mode as "d20 plus six attributes, hard-coded," that is still the default (**Marinara's own rules**, internally `engine-legacy`). It is no longer the only option. A game can be created on a **ruleset**: one JSON file that tells the Engine how a tabletop system rolls, what's on its character sheet, what gets spent and rested back, and optionally how its fights, items and opponents work. The full author guide is `docs/extending/writing-rulesets.md`, about 2,500 lines and the source for everything below. Players should start with `docs/game/getting-started.md#choosing-rules`.

## What a ruleset is

- **Data, not code.** It has no expression strings, nothing in it is ever evaluated, and it brings no package code (header of `packages/shared/src/schemas/ruleset.schema.ts`). Importing one can't do anything to the user's machine. The risk lives in its **Game Master text** (see below).
- **It fills in blanks the Engine already has.** The file picks one of a closed set of Engine-owned resolution kinds and declares a sheet from a closed set of primitives. The Engine owns rolls, modifiers, resource arithmetic and legality. The GM model only picks what to check and how hard, then narrates the real result.
- **A ruleset never adds a model call.** Checks use the existing dice flow, sheet changes come from tags in the GM's own narration, and no ruleset registers a tool or ships a per-turn agent (`docs/development/game-rulesets-and-sheets-implementation.md`, Product contract). The feature was requested by the author of a 16-system RPG overlay that needed 4–5 per-turn agents per system. A ruleset replaces all of that at no extra token cost per turn.
- **Nothing is 5e-shaped.** The Engine never looks for `level`, `dex`, `hp` or `slots`, and every id comes from the file. The reserved ruleset ids are `engine-legacy` and `traditional`.

## Route here, or somewhere else?

| The user wants… | Route |
|---|---|
| "Real D&D 5e," "my own TTRPG," a 2d6 or dice-pool system **played in Game Mode**: DCs, sheets, spell slots, rests, a bestiary, tactical distance | **A ruleset** (this file). Install an official one, import a community file, or write one. |
| A character that *explains* rules (rules lawyer, rules Q&A) | Card or lorebook (`decision-guide.md` Q1–2). A ruleset is for *playing* in Game Mode only. |
| Dice in Conversation or Roleplay | Built-in `roll_dice` or a `script` custom tool (`custom-tools.md`). Rulesets only exist in Game Mode. |
| Per-turn stat tracking outside Game Mode | Tracker agents and packages (`agents.md`). |
| A whole custom Game UI, HUD or combat screen | A package **Experience** (`game-surface`), not a ruleset. See below. |
| A mechanic neither resolution kind can express | **Engine PR** (Mode B). A JSON file can't add one. |

Don't build per-turn agents or dice tools to *emulate* a system inside Game Mode. A ruleset does it with Engine-enforced math.

### The hard limit: two resolution kinds

`RULESET_RESOLUTION_KINDS = ["dice-sum", "dice-pool"]`. The file picks one with `resolution.kind`:

- **`dice-sum`**: roll `dice` (`{count, sides}`), add sheet numbers, meet or beat a `difficultyLadder` step's `dc`. This covers d20 and 2d6+stat systems. `advantage` and `naturals` (`none`/`both`/`max-only`/`min-only`, single die only, so 2d6 must use `none`) are optional.
- **`dice-pool`**: the sheet number is the **pool size**. Throw a `die` (2–100 sides) and count faces at or above a `target`, against a ladder of `successes`. Optional keys are `explode`, `double`, `cancel`, `botch`, `exceptional`, `situationalDice` and `reroll` (≤6 free re-throws), plus `spend` (≤4 paid purchases of successes, dice or a re-throw; pool-only, and refused on `dice-sum`).
- Both kinds share `abilityModifier` (`identity`, `floorHalfMinusTen` = the 5e rule, or `stepTable`), `proficiencyTiers` and `proficiency`. They can also carry `adjust` (≤8 sheet values added to rolls, such as encumbrance or a stance) and `penaltyFrom` (a wound track's penalty applied to every check).

**Out of scope, each needs a new resolution kind:** take-the-highest-die (Blades in the Dark), stance-vs-stat over/under (Lasers and Feelings), symbol dice (Genesys), opposed pools, roll-under and open-ended percentile, and sum pools with a wild die (OpenD6). A new kind is an Engine code contribution with tests. Tell the user to open a feature request on the Engine repo that describes the mechanic with a few worked rolls, because those rolls become the tests. Fights are closed the same way: `combat.kind` is `attack-vs-defense` or `dice-pool`. The guide's **Not yet** section lists the combat gaps: no elevation, mounts, hiding or surprise, no reaction stacks, no refunds, and a closed list of what conditions can change. Check it before promising a combat rule.

## Authoring map (top-level keys)

For editor autocomplete and type checking, add this as the first line inside the outer braces:
`"$schema": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Engine/staging/docs/extending/ruleset.schema.json",`

The schema is generated from the zod schema. It catches misspelled keys and wrong types but **not** dangling references, such as a skill that names a removed ability. Import catches those. `"$comment"` is allowed on any object. **Everything else is strict**: an unknown key refuses the whole file, with `path: message` lines.

| Key | Req? | Holds |
|---|---|---|
| `schemaVersion` | ✅ | Always `1` |
| `id` | ✅ | Lowercase letters, digits, single hyphens (`ember-roads`), ≤64 chars. The file always carries the **bare** id. |
| `version` | ✅ | Integer ≥1. Raise it on every published change. |
| `name` / `edition` | ✅ / – | Wizard name / one-line edition note |
| `license` | – | `spdx` + `attribution` |
| `coverage` | ✅ | Booleans `checks`, `saves`, `sheet`, `resources`, `rests`, `combat`, plus a **required** `summary` shown in the wizard. Set `combat` only if fights really follow the ruleset. |
| `resolution` | ✅ | The dice (above) |
| `sheet` | ✅ | `version` (required, raise it when the sheet's shape changes), `sections`, `abilities`, `skills` and `saves` (each may take `cap` and `untrained`: `"normal"`, `{by:N}`, `"harder"` or `"refuse"`), `fields` (`number`/`text`/`longtext`/`boolean`/`enum`/`dice`), `derived` (`sum`/`min`/`max`/`scale`/`stepTable`/`enumTable`), `lists` (tables, where `pools` makes each row a limited-use counter), and `live`: `pools`, `tracks`, `text`, `conditions` and `states` (form or stance) |
| `rests` | – | Restore steps (`pool`/`poolGroup`/`listPools`/`track`/`state`, set with `to` or changed with `by`). Defaults to none. |
| `gm` | ✅ | `checkGuidance` (required), `sheetGuidance`, `worldGuidance`, `sheetSummary` |
| `catalogs` | – | ≤12. `holds: "rows"` (sheet picker entries that `feeds` named lists), `"creatures"` (a **bestiary**, which needs `combat` + `combat.threat`), or `"items"` |
| `items` | – | Item vocabulary: `categories`, `rarities`, `tags`, `stats`, `slots`, `binding`, `carry`, `currencies`, `rarityCaps`, `propose`, `native`, `freeform`, `lootTables`, `market` |
| `battle` | – | Lends the sheet to **Marinara's own** combat (see below) |
| `combat` | – | Fights **resolved by the ruleset** (see below) |
| `layers` | – | ≤12 per-game variants (see below) |

- **Limits:** the file is ≤**256 KB**, a stored character sheet ≤**64 KB**, a catalog ≤2,000 entries (1 MB as a separate package file). Prompt-bound text (names, labels, GM text) must be one line with **no square brackets and no `{{`**. Sheet ids are `lowercase_with_underscores` starting with a letter.
- **Value references** are how anything reads a number: an object with exactly one key from `const`, `field`, `derived`, `abilityScore`, `abilityMod`, `abilityModFromField`, `skillMod`, `saveMod`, `listSum`, `livePool`, `liveTrack` or `itemStat`. Derived values can only read values declared *above* them, so cycles can't be expressed. Live reads (`livePool`, `liveTrack`, `liveState`, `itemStat`) can't feed a maximum or the proficiency bonus.
- **Health pool vs. wound track:** a pool records *how much* harm, while a wound track (`live.tracks` with `kinds` plus `levels` *or* numbered `boxes`) records *how much and what kind*. Systems with bashing, lethal or aggravated wounds need a track. `combat.damageKinds` on a pool-health ruleset is refused, not ignored (v2.5.0, #6407, #6654).
- **Catalogs:** picking an entry writes 1–6 **copies** onto the sheet, each tagged `_catalog: "<catalog>/<entry>"`. The player owns the copy, and a new ruleset version never rewrites a character. `scaled` lets a row's number column follow the sheet, for example uses = an ability score. **Refresh from ruleset → Review → Update selected** offers newer *text* only. An entry's optional `mechanics` block (closed vocabulary: `kind`, `range`, `area`, `amount`, `save`, `applies`, `cost`, `reaction`, `check`, …) is what fights and the GM's `use` command read.
- **Layers** (e.g. Low magic, Hard winter) are wizard toggles, fixed for the game's lifetime. A layer can only **narrow or add text**: append `gm.guidance` or `gm.worldGuidance`, remove enum values, replace the difficulty ladder, hide catalog entries, or remove coins. It can't add fields or values, touch live state or combat numbers, or add a model call. Use `conflicts` for mutually exclusive layers. 4,000 characters of guidance per layer.

### `battle` vs. `combat`: the most common confusion

| | `battle` (bridge) | `combat` (ruleset-resolved) |
|---|---|---|
| Who does the math | Marinara's own combat | The ruleset's dice and numbers, server-side |
| What it does | Carries health in **as a share of max** and writes it back, maps `energy` to MP and `slots` to spell slots, and turns catalog rows that have `mechanics` into skills | `health` (pool or wound track), `defense`, `initiative`, `attackRoll`, an action `economy`, `attacks`/`abilities` lists, `conditions`, `concentration`, `threat`, `distance`, contests, reactions and counters |
| What it ignores | Attack rolls, saves, concentration | See the guide's **Not yet** section |
| Writes back | Once, at the end. An abandoned fight writes nothing. | **After every action**, so closing the tab mid-fight loses nothing |

If a ruleset declares `combat`, the `battle` path is never used. Opponents come, in order, from the named **bestiary** creature, then a label match, then a GM-proposed stat block pulled onto the ruleset's `threat` scale (with the changes logged in plain words), then the threat rung's plain numbers. With none of those available, the fight is refused. **`combat.distance`** (`{label, perCell}`) makes a fight playable on a grid in the ruleset's units, e.g. Ember Roads `"paces", 2` or 5e `"ft", 5`. Only `distance` is needed; `ranged`, `cover` and `opportunity` are optional.

## Game Master text: review it before importing anyone's ruleset

- `checkGuidance` replaces Marinara's built-in "how to ask for a check" paragraph. `sheetGuidance` introduces the sheets. Both are rendered into the GM's **per-turn reminder** in every game on that ruleset. `worldGuidance` is read **once**, at world generation, and never on a turn. `sheetSummary` picks which fields, derived values and list rows the GM sees each turn, so keep it short.
- This is the only part of a ruleset that steers the model. Treat it like a card's system prompt from a stranger. The import review shows it **verbatim** and says it is sent to the model.
- Authoring advice: never ask the model to do math (the Engine rolls and adds up), and **don't teach commands**. The Engine teaches every tag itself, using the file's own names, and adds `op="damage"` for wound tracks and `op="state"` for live states automatically.
- A catalog is a picker source, not prompt text. The v2.5.0 changelog says "catalog text is never sent to the model." What the GM *does* see is the sheet rows that `sheetSummary` selects, held items with their `promptVisible` stats, and short name lists where markets or invented creatures are in play.

**Tags the GM writes and the Engine resolves** (each is rewritten in place with `result="ok"` or `result="refused" reason="…"`; numbers the model invents are replaced): `[skill_check: skill= dc= who="Name" difficulty="Hard" with="Ability" threshold= bonus= reroll= spend="pool:N"]`, `[sheet: who= op=spend|restore|heal|damage|temp|track|condition|note|rest|state|use|cast]` (`use` pays an entry's whole cost all-or-nothing, and `pool=` upcasts within a pool group), `[inventory: action=add|equip|unequip|bind|unbind|use|pay|earn|buy]`, `[loot: table= who=]`, `[place: name= size=]`.

## Using one (player side)

- **New-game wizard → World step:** **Combat Preference** (Classic/Tactical), then **Rules** below it. **Rules** appears only when at least one ruleset is installed, and only for a new game. The default is **Marinara's own rules**. Picking a ruleset shows its coverage summary, one line on what battles will do, and its layers as toggles. **The ruleset is fixed for the game's lifetime** and can't be changed or added later.
- **Combat Preference with a ruleset that resolves its own fights and declares `distance`:** Classic = no positions, Tactical = a board measured in the ruleset's units. A ruleset with no distance keeps the preference but doesn't use it. ↺ An earlier same-release changelog entry said the preference was "kept and not used" for such games. The board entry supersedes it.
- **Sheets:** in the character or persona editor, open the **Stats** tab → **Ruleset sheets** → **Add a sheet**. The layout comes from the ruleset, lists it fills get **Add from catalog**, and cells the ruleset keeps show "Set by the ruleset." A sheet is a **starting build**. The game copies it at world generation, and **nothing in a game writes back** to the card or persona. The Party step shows **Has a sheet** or **Starts on a blank sheet** (ruleset defaults; world generation never invents scores). Sheets for uninstalled rulesets are kept as one removable line, never sent to the AI, and still travel with exports. Ruleset sheets are separate from **Enable RPG Stats/Attributes**.
- **In play:** checks use the ruleset's dice, ladder, sheet and natural-result rule (under 5e SRD 5.1, a natural 20 or 1 does nothing special on checks and saves). The character sheet shows live pools, conditions, rest buttons and **Edit sheet**. Live values belong to the message they happened in, so **a swipe or regenerate never spends twice**. The inventory's **From the ruleset** picker lists the ruleset's items. Rulesets with `currencies`, `lootTables` and a `market` get real coins, loot drops and priced buying (Capability API 1.63–1.65, #6894, #6901, #6917).
- **Shared setup files** (`.marinara-game-setup.json`) carry the ruleset. If it's missing or older on the importing install, the wizard names it and the game falls back to Marinara's own rules unless the user installs and picks it.

## Sharing, trust and versions

- **Import a file:** turn on **Settings → Advanced → Danger Zone → Allow custom Agent imports** (the same switch as agent imports; also needs localhost access or configured **Admin Access**). Then **Agents panel → Import agents** (the download icon) **→ Game Mode ruleset** → pick the JSON. The whole file is checked before anything is stored. The review shows the name, version, license, coverage, how checks roll and the full GM text, then **Import**. The ruleset appears in the Agents panel's **Rules** section and in the wizard.
- **Namespacing:** a file import is filed as `local/<id>`, and a repo import as `<owner>/<id>` (the GitHub owner, lowercased, e.g. `alice/v20`), so a community ruleset can **never replace an official one** or collide with another author's. A GitHub account named `local` can't publish rulesets.
- **Versions are immutable:** importing the same bytes again does nothing, while different bytes under an existing `version` are refused with a prompt to raise it. Every version stays installed side by side. **A game on a community ruleset is pinned to the exact version it was created on.** Official packages instead need the installed version to be at least the pinned one. The drafting loop is: edit, raise `version`, import, start a *new* game.
- **Gate off:** imported rulesets disappear from *new* games, while existing games keep working. Removal (in the **Rules** section) works even with the gate off. Removing a ruleset that games still use asks again with the count, and those games then report the ruleset as missing until the user re-imports that version.
- **Custom agent repositories:** put a `rulesets/` folder at the repo top, holding at most **32** JSON files as direct children, alongside an optional `agents.json`. This requires `ENABLE_CUSTOM_AGENT_REPOS=true` on the server (repo flow: `agents.md`). One bad file shows up as a preview row with its reasons, and a ruleset withdrawn upstream stays installed. A file or repo import carries its catalogs **inline**, inside the 256 KB limit.
- **Official catalog:** open a PR to **Pasta-Devs/Marinara-Agents**, using the `ruleset-5e-2014` package's layout as the model. Download Agents marks such packages **Rules**: they add a ruleset, aren't agents, and have nothing to switch on in a chat. **At the v2.5.0 sync the 5e (SRD 5.1) package is preview/staging-only**, and a stable Engine doesn't list it. Check Download Agents for the live state.
- **Licensing:** copy only openly licensed rules text (SRDs), fill in `license.spdx` and `attribution`, and write the GM text in your own words.

## Capability API (packaged rulesets only)

- A package of kind **`ruleset`** (Capability API **1.20**) ships the reserved asset `ruleset.json`, listed in `contributions.assets.paths` and hash-pinned in `files[]`. It needs no permission, no entrypoint and no agent, and the kind and the asset must go together. Separate `catalogs/<id>.json` files are package-only (1.21).
- Each feature key gates on a version. An Engine that can't read a key refuses the whole file, so a package declares the highest version any of its keys needs: 1.22 `battle`, 1.23 `scaled`, 1.24 `dice-pool`, 1.25 layers/`worldGuidance`, 1.26 `combat`, 1.27 bestiary, 1.28 `distance`, 1.30 wound tracks, 1.33 reaction moments, 1.34 creature `sheet`, 1.37–1.44 check and sheet refinements (states 1.42, contests 1.43, counters 1.44), 1.47 `dice-pool` fights, 1.49 `items`, up to 1.65 markets. The per-key table is in the guide, and per-version notes are in `docs/development/optional-agent-packages.md`. The host is at **Capability API 1.66 (v2.5.0)**.
- **A community ruleset imported as a file or from a repo needs no Capability API declaration.** The Engine that reads it validates it. Version numbers only matter for packages.

## Not the same as an Experience

A package **Experience** (`game-surface` slot, Capability API 1.8+) is a whole custom Game Mode with its own HUD, menus and combat, made of package **code**. It's picked from the wizard's Experiences block and declares which built-in systems it replaces. A ruleset is **data** that changes the *rules* under the standard Game UI. The two are independent choices on the same game. Route "I want my own game screen" to Experiences (a capability package, Mode B-adjacent), and "I want my system's dice and sheets" here.

## Validate before scaling

1. Copy the example that matches the system's dice: `docs/examples/rulesets/ember-roads.json` (2d6, three stats, Grit/Luck, `battle` + `combat` with `"paces"` distance, items, a bestiary, a Hard winter layer) or `gravewatch.json` (d10 pool, three ratings and six trades, a Harm wound track, `dice-pool` fights, a market, a "The long night" layer). For a full d20 build, use `docs/development/ruleset-5e-2014.example.json`.
2. Change `id`, add `"$schema"`, and edit the sheet, rests and GM text, nothing else yet.
3. Import it, read the review, start a **new** game on it, and play a few checks and a rest.
4. Only then add catalogs, items, `combat`, a bestiary or layers, **one block at a time**: raise `version`, re-import, and start a new game after each.

**Mode B notes:** the authority is `packages/shared/src/schemas/ruleset.schema.ts`. Regenerate the published schema with `pnpm ruleset:schema` (a regression fails when it's stale). The server side is `services/game/` (`skill-check-resolution.service.ts`, `ruleset-registry.service.ts`, `ruleset-sheet-turn.service.ts`, `ruleset-combat-director.service.ts`). The design handoffs are `docs/development/game-rulesets-and-sheets-implementation.md` and `game-combat-rulesets-implementation.md`.

## Related references

- `architecture.md`: Game Mode overall (setup wizard, Combat Preference, engine-rolled checks)
- `agents.md`: Download Agents, custom agent repositories, the **Allow custom Agent imports** gate
- `custom-tools.md`: `roll_dice` and script tools for dice *outside* Game Mode
- `decision-guide.md`: the full "which surface?" walk
- Engine docs: `docs/extending/writing-rulesets.md` (author), `docs/game/getting-started.md#choosing-rules`, `docs/game/dice-and-skill-checks.md`, `docs/game/combat.md`, `docs/characters/colors-and-stats.md#ruleset-sheets` (player)
