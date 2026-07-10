# Changelog

All notable changes to this project are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## 3.0.0

A major release focused on accessible, cross-device drag-and-drop, a
backend-friendly state model, and large-board performance.

### ⚠️ Breaking changes

- **Drag-and-drop engine.** Native HTML5 drag-and-drop is replaced with
  [dnd-kit](https://dndkit.com/) so dragging works on touch and keyboard. The
  package now depends on `@dnd-kit/core`, `@dnd-kit/sortable`,
  `@dnd-kit/utilities` (and `@tanstack/react-virtual` for optional
  virtualization). These install automatically.
- **`renderCard` signature.** The second argument changed from
  `handleDragStart` to `isDragging: boolean`:
  `(card, isDragging?, isExpanded?, toggleExpand?) => ReactNode`. Custom cards no
  longer wire drag events — the whole card is a drag handle. Remove any
  `draggable` / `onDragStart` you added.
- **`initialCards` is now uncontrolled.** It seeds the board's state only once,
  on mount; later changes are ignored. In v2 it reset the board on every change
  (which could wipe card ordering on a parent re-render). If you drive cards from
  a backend, switch to controlled mode (`cards` + `onCardsChange`).

### ✨ Added

- **Touch drag-and-drop** — press-and-hold to drag on touchscreens.
- **Keyboard-accessible drag-and-drop** — focus a card, `Space` to pick up,
  arrow keys to move (within and across columns), `Space`/`Enter` to drop, `Esc`
  to cancel, with screen-reader announcements.
- **Controlled mode** — pass `cards` + `onCardsChange` to render a
  fully-controlled board that stays in sync with external/backend state. New
  `ControlledKanbanBoard` export makes the contract type-safe. `onCardsChange`
  also fires in uncontrolled mode.
- **`onCardMove` drop position** — the callback now receives a third
  `DropPosition` argument (`{ prevTaskId, nextTaskId, index }`) and fires on
  same-column reordering too, so consumers can persist ordering on a backend.
  (Closes the original feature request.)
- **Delete confirmation / undo** — `deleteConfirmation` (`"immediate"` |
  `"confirm"` | `"undo"`) plus `undoDuration`. `confirm` shows an inline prompt;
  `undo` removes the card immediately and defers `onCardDelete` behind an undo
  toast.
- **Per-column loading & empty states** — `Column.isLoading` (built-in skeleton
  or `renderColumnLoading`) and `Column.emptyMessage` (overrides
  `emptyColumnMessage`).
- **Opt-in column virtualization** (experimental) — `virtualizeColumnsOver`
  windows large columns for performance (a 300-card column dropped from ~6,200 to
  ~350 DOM nodes in testing). Known limitation: no auto-scroll to off-screen drop
  targets while dragging; see the README.
- **Generated API reference** — `docs/API.md` is generated from the TypeScript
  source (`npm run docs`), with `npm run docs:check` to prevent drift.
- **End-to-end test suite** — Playwright specs covering drag (mouse/touch/
  keyboard), delete modes, loading/empty, controlled/uncontrolled, WIP limits and
  virtualization (`npm test`).

### 🐛 Fixed

- Parent re-renders that passed a fresh `initialCards` array no longer reset card
  ordering (superseded by the controlled/uncontrolled split above).

## 2.0.0

- Customizable Kanban board with drag-and-drop, search, filtering, WIP limits,
  avatars, and custom render props.
