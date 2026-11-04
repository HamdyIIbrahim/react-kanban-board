# Changelog

All notable changes to this project are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## 3.0.0

A major release focused on accessible, cross-device drag-and-drop, a
backend-friendly state model, large-board performance, and a package that
works in every React setup (SSR, Next.js App Router, ESM and CommonJS).

### ✅ Backward compatible

Why a major version if nothing breaks? 3.0 replaces the drag-and-drop engine
(native HTML5 → dnd-kit), adds dependencies and changes the internal markup
and how styles load. Your code keeps working, but those changes deserve an
opt-in upgrade rather than arriving automatically through a `^2.0.0` range.
Test suites that simulate native `dragstart` / `drop` events, or CSS that
targets internal wrappers (e.g. `.motion-card-wrapper`), may need updating.

3.0 is a drop-in upgrade from 2.0 — existing code needs no changes:

- Styles are still applied automatically: the board injects its stylesheet on
  the client (skipped when `styles.css` is already loaded; `injectStyles` /
  `styleNonce` for strict CSPs). It no longer `require()`s CSS from JS, which
  crashed Node, SSR and Jest.
- `renderCard(card, handleDragStart, isExpanded, toggleExpand)` keeps the 2.0
  signature. `handleDragStart` is now a no-op (dnd-kit handles dragging for
  every card) and a 2.0 `draggable` attribute is neutralised.
- `onCardMove` still fires only when a card changes column; same-column
  reorders go to the new `onCardReorder`.
- Changing `initialCards` to new data still updates the board (now compared by
  content, so a re-render with an equal array no longer resets the ordering).
- `Card`, `Column`, `FilterConfig`, `FilterOption` types are unchanged;
  `columnForAddCard`, `onTaskAddedCallback` and every other 2.0 prop still work.
- `main` / `types` are the same files and `dist/KanbanBoard.css` still exists;
  `module` now points at a real ES module (`dist/esm/index.js`).
- Search still matches card titles by default (`searchFields` opts into more).
- Drag-and-drop now uses [dnd-kit](https://dndkit.com/) (`@dnd-kit/*` and
  `@tanstack/react-virtual` install automatically). `framer-motion` is no
  longer a dependency, and React is a peer dependency only.

### ✨ Added

- **SSR & Next.js App Router support** — ESM + CommonJS builds with an
  `exports` map, a `"use client"` directive on the client entry, and a
  server-safe `react-custom-kanban-board/utils` entry for the pure helpers.
- **Headless `useKanban` hook** — the board's state engine without UI:
  `moveCard`, `addCard`, `updateCard`, `deleteCard`, `addColumn`,
  `renameColumn`, `deleteColumn`, `moveColumn`. Also a pure `moveCard` util.
- **Generic card typing** — `<KanbanBoard<MyCard> />`, `useKanban<MyCard>()`;
  `swimlaneBy` is checked against your card's keys.
- **Card details panel** — `enableCardDetails` (double-click or the open
  button) to edit every field including `cardFields`; `onCardUpdate(id,
  patch)`; `renderCardDetails` / `renderCardDetailsExtra` to customise it.
- **Column management** — `enableColumnManagement` (add / rename / delete
  columns), `enableColumnCollapse`, `onColumnsChange`, `onColumnAdd`,
  `onColumnRename`, `onColumnDelete`, `onColumnCollapseChange`,
  `renderColumnHeader`.
- **Adding cards in any column** — `Column.allowAddCard`, `onCardAdd(card,
  columnKey)`, `createCardId`.
- **Custom priorities** (`priorities` with labels and colours) and **due-date
  highlighting** (overdue / due today / due soon; `dueSoonDays`,
  `highlightDueDates`, `Column.isDone`).
- **Load more** — `Column.hasMore` / `isLoadingMore` + `onLoadMore`.
- **i18n & RTL** — `labels` overrides every UI string (`KanbanLabels`,
  `defaultLabels`); `dir="rtl"` mirrors the layout. Screen-reader
  announcements now use card and column titles instead of ids.
- **Custom card actions** — `renderCard` receives a fifth `actions` argument
  (`isDragging`, `edit`, `delete`, `openDetails`, `isSelected`).
- `usePersistentBoard` gains `onCardReorder`, `onCardUpdate` and `onCardAdd`
  (and is generic over your card type, like `diffCards`).

- **Touch drag-and-drop** — press-and-hold to drag on touchscreens.
- **Keyboard-accessible drag-and-drop** — focus a card, `Space` to pick up,
  arrow keys to move (within and across columns), `Space`/`Enter` to drop, `Esc`
  to cancel, with screen-reader announcements.
- **`searchFields`** — choose which card fields the search box matches.
- **Controlled mode** — pass `cards` + `onCardsChange` to render a
  fully-controlled board that stays in sync with external/backend state. New
  `ControlledKanbanBoard` export makes the contract type-safe. `onCardsChange`
  also fires in uncontrolled mode.
- **Drop position** — `onCardMove` now receives a third `DropPosition`
  argument (`{ prevTaskId, nextTaskId, index }`), and the new `onCardReorder`
  reports same-column reordering with the same data, so consumers can persist
  ordering on a backend. (Closes the original feature request.)
- **Delete confirmation / undo** — `deleteConfirmation` (`"immediate"` |
  `"confirm"` | `"undo"`) plus `undoDuration`. `confirm` shows an inline prompt;
  `undo` removes the card immediately and defers `onCardDelete` behind an undo
  toast.
- **Per-column loading & empty states** — `Column.isLoading` (built-in skeleton
  or `renderColumnLoading`) and `Column.emptyMessage` (overrides
  `emptyColumnMessage`).
- **Opt-in column virtualization** (experimental) — `virtualizeColumnsOver`
  windows large columns for performance (a 300-card column dropped from ~6,200 to
  ~350 DOM nodes in testing). Dragging auto-scrolls the column and the dragged
  card stays mounted, so long-distance reorders work in one motion.
- **Generated API reference** — `docs/API.md` is generated from the TypeScript
  source (`npm run docs`), with `npm run docs:check` to prevent drift.
- **End-to-end test suite** — Playwright specs covering drag (mouse/touch/
  keyboard), delete modes, loading/empty, controlled/uncontrolled, WIP limits and
  virtualization (`npm test`).
- **Theming** — a namespaced `--kb-*` design-token layer, a ready-made
  `.kb-dark` theme, and `className` / `style` props to scope themes.
- **Column reordering** — `enableColumnReorder` + `onColumnsReorder`; drag
  columns via a header grip (mouse / touch / keyboard).
- **Export / import** — `exportCardsToJSON` / `exportCardsToCSV` and
  `importCardsFromJSON` / `importCardsFromCSV`.
- **Backend persistence** — `usePersistentBoard` hook with optimistic updates
  and automatic rollback on failure.
- **Bulk actions** — `enableMultiSelect` with multi-select (Cmd/Ctrl-click,
  Shift-range) and a bulk move/delete bar (`onBulkMove` / `onBulkDelete`).
- **Typed card field schema** — `cardFields` (`CardFieldDef[]`) renders custom
  fields in card details; `validateCard` validates them.
- **Activity log** — `useActivityLog` builds a per-card audit trail.
- **Realtime collaboration** — `diffCards` produces minimal patches for
  websocket / Convex-style live sync (controlled mode + broadcast), and
  `applyCardChanges` applies them on the receiving side.
- **Swimlanes** — `swimlaneBy` groups cards into horizontal lanes by a field;
  dragging across lanes updates that field.
- **Playground demo** — an interactive showcase with a live event stream and
  four view presets (Default, CRM, Compact, Table).

### 🐛 Fixed

- The package can be `require()`d / imported in plain Node and server-rendered.
- `module` pointed at a CommonJS file and there was no `exports` map, which
  prevented tree-shaking; CSS is now declared as a side effect so bundlers keep
  it.
- The shipped CSS is autoprefixed and no longer embeds an inline source map
  (67 KB → 28 KB).
- `usePersistentBoard` could roll back to the wrong snapshot after a failed
  delete or title edit (state is now updated before the callback fires).
- Card ids created by the board use `crypto.randomUUID()` instead of
  `Date.now()` (no collisions when adding quickly).
- The "Add card" control is a real `<button>`.
- Filter dropdowns say "All Priorities" / "All Statuses" instead of "All
  Prioritys" / "All Statuss".

- Parent re-renders that passed a fresh but equal `initialCards` array no
  longer reset card ordering.

## 2.0.0

- Customizable Kanban board with drag-and-drop, search, filtering, WIP limits,
  avatars, and custom render props.
