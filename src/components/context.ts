import { createContext, useContext } from "react";
import type { Dispatch, MouseEvent, ReactNode, SetStateAction } from "react";
import type {
  Card,
  CardFieldDef,
  Column,
  ColumnHeaderInfo,
  DeleteConfirmation,
  PriorityDef,
  RenderCard,
} from "../types";
import type { KanbanLabels } from "../labels";
import type { KanbanController } from "../useKanban";

// Board-wide configuration and callbacks shared with columns and cards. The
// board renders its children through this context rather than prop-drilling.
export interface BoardContextValue {
  labels: KanbanLabels;
  kanban: KanbanController<Card>;
  cards: Card[];
  setCards: Dispatch<SetStateAction<Card[]>>;
  mounted: boolean;
  renderCard?: RenderCard<Card>;
  renderAvatar?: (avatarPath?: string) => ReactNode;
  renderAddCard?: (
    column: string,
    setCards: Dispatch<SetStateAction<Card[]>>
  ) => ReactNode;
  renderColumnHeader?: (column: Column, info: ColumnHeaderInfo) => ReactNode;
  renderColumnLoading?: (column: Column) => ReactNode;
  onCardEdit?: (cardId: string, newTitle: string) => void;
  onCardUpdate?: (cardId: string, patch: Partial<Card>) => void;
  onCardDelete?: (cardId: string) => void;
  onCardAdd?: (card: Card, columnKey: string) => void;
  onTaskAddedCallback?: (title: string) => void;
  createCardId?: () => string;
  columnForAddCard?: string;
  emptyColumnMessage: string;
  deleteConfirmation: DeleteConfirmation;
  undoDuration: number;
  cardFields?: CardFieldDef[];
  priorities: PriorityDef[];
  highlightDueDates: boolean;
  dueSoonDays: number;
  enableCardDetails: boolean;
  openDetails: (cardId: string) => void;
  virtualizeColumnsOver?: number;
  virtualItemEstimatedHeight: number;
  enableMultiSelect: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (
    cardId: string,
    e: MouseEvent,
    columnCardIds: string[]
  ) => void;
  enableColumnCollapse: boolean;
  isCollapsed: (columnKey: string) => boolean;
  toggleCollapse: (columnKey: string) => void;
  enableColumnManagement: boolean;
  renameColumn: (columnKey: string, title: string) => void;
  deleteColumn: (columnKey: string) => void;
  onLoadMore?: (columnKey: string) => void;
  activeCardId: string | null;
  wipBlockedColumn: string | null;
}

export const BoardContext = createContext<BoardContextValue | null>(null);

export const useBoard = (): BoardContextValue => {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error("KanbanBoard components must render inside <KanbanBoard>.");
  return ctx;
};
