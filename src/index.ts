// Client entry: the board component, hooks and (re-exported) utilities.
// The build prepends "use client" to this entry so it works in React Server
// Component frameworks (Next.js App Router). Pure helpers are also available
// without the directive from "react-custom-kanban-board/utils".
import { KanbanBoard } from "./KanbanBoard";

export { KanbanBoard, ControlledKanbanBoard } from "./KanbanBoard";
export type { ControlledKanbanBoardProps } from "./KanbanBoard";
export { useKanban } from "./useKanban";
export type {
  UseKanbanOptions,
  KanbanController,
  MoveResult,
} from "./useKanban";
export { usePersistentBoard } from "./usePersistentBoard";
export type { PersistenceAdapter, PersistentBoard } from "./usePersistentBoard";
export { useActivityLog } from "./useActivityLog";
export type { ActivityEntry, ActivityLog } from "./useActivityLog";
export { defaultLabels } from "./labels";
export type { KanbanLabels } from "./labels";
export * from "./utils";

export default KanbanBoard;
