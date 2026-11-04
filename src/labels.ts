// Every user-facing string the board renders. Pass a partial object through the
// `labels` prop to translate or reword any of them.
export interface KanbanLabels {
  loadingBoard: string;
  emptyColumn: string;
  searchPlaceholder: string;
  searchAriaLabel: string;
  clearSearch: string;
  filterAll: (fieldLabel: string) => string;
  filterBy: (fieldLabel: string) => string;
  clearFilters: string;
  addCard: string;
  addCardPlaceholder: string;
  addCardAriaLabel: string;
  newCardTitle: string;
  cancel: string;
  save: string;
  close: string;
  delete: string;
  editCard: string;
  editCardTitle: string;
  deleteCard: string;
  openCard: string;
  expandCard: string;
  collapseCard: string;
  deleteConfirm: string;
  cardDeleted: string;
  undo: string;
  wipReached: (limit: number) => string;
  selectedCount: (count: number) => string;
  moveTo: string;
  clear: string;
  bulkActions: string;
  ungrouped: string;
  due: string;
  overdue: string;
  dueToday: string;
  dueSoon: string;
  loadMore: string;
  loadingMore: string;
  reorderColumn: (columnTitle: string) => string;
  collapseColumn: (columnTitle: string) => string;
  expandColumn: (columnTitle: string) => string;
  addColumn: string;
  newColumnTitle: string;
  renameColumn: (columnTitle: string) => string;
  deleteColumn: (columnTitle: string) => string;
  deleteColumnConfirm: (columnTitle: string, cardCount: number) => string;
  cardDetails: string;
  fieldTitle: string;
  fieldDescription: string;
  fieldPriority: string;
  fieldDueDate: string;
  fieldAssignee: string;
  fieldTags: string;
  tagsHint: string;
  none: string;
  announcePickUp: (cardTitle: string) => string;
  announceOver: (cardTitle: string, targetTitle: string) => string;
  announceNotOver: (cardTitle: string) => string;
  announceDrop: (cardTitle: string, targetTitle: string) => string;
  announceDropBack: (cardTitle: string) => string;
  announceCancel: (cardTitle: string) => string;
}

// "Priority" -> "Priorities", "Status" -> "Statuses", "Assignee" -> "Assignees".
const pluralize = (word: string): string => {
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + "ies";
  if (/(s|x|z|ch|sh)$/i.test(word)) return word + "es";
  return word + "s";
};

export const defaultLabels: KanbanLabels = {
  loadingBoard: "Loading board...",
  emptyColumn: "No cards yet",
  searchPlaceholder: "Search cards...",
  searchAriaLabel: "Search cards",
  clearSearch: "Clear search",
  filterAll: (label) => `All ${pluralize(label)}`,
  filterBy: (label) => `Filter by ${label}`,
  clearFilters: "Clear Filters",
  addCard: "Add Card",
  addCardPlaceholder: "Enter card title...",
  addCardAriaLabel: "Add new card",
  newCardTitle: "New card title",
  cancel: "Cancel",
  save: "Save",
  close: "Close",
  delete: "Delete",
  editCard: "Edit card",
  editCardTitle: "Edit card title",
  deleteCard: "Delete card",
  openCard: "Open card details",
  expandCard: "Expand card",
  collapseCard: "Collapse card",
  deleteConfirm: "Delete this card?",
  cardDeleted: "Card deleted",
  undo: "Undo",
  wipReached: (limit) => `WIP limit (${limit}) reached!`,
  selectedCount: (count) => `${count} selected`,
  moveTo: "Move to",
  clear: "Clear",
  bulkActions: "Bulk actions",
  ungrouped: "Ungrouped",
  due: "Due",
  overdue: "Overdue",
  dueToday: "Due today",
  dueSoon: "Due soon",
  loadMore: "Load more",
  loadingMore: "Loading...",
  reorderColumn: (title) => `Reorder column ${title}`,
  collapseColumn: (title) => `Collapse column ${title}`,
  expandColumn: (title) => `Expand column ${title}`,
  addColumn: "Add column",
  newColumnTitle: "Column title",
  renameColumn: (title) => `Rename column ${title}`,
  deleteColumn: (title) => `Delete column ${title}`,
  deleteColumnConfirm: (title, count) =>
    count > 0
      ? `Delete "${title}" and its ${count} card${count === 1 ? "" : "s"}?`
      : `Delete "${title}"?`,
  cardDetails: "Card details",
  fieldTitle: "Title",
  fieldDescription: "Description",
  fieldPriority: "Priority",
  fieldDueDate: "Due date",
  fieldAssignee: "Assignee",
  fieldTags: "Tags",
  tagsHint: "Comma separated",
  none: "None",
  announcePickUp: (card) => `Picked up card ${card}.`,
  announceOver: (card, target) => `Card ${card} is over ${target}.`,
  announceNotOver: (card) => `Card ${card} is no longer over a drop target.`,
  announceDrop: (card, target) => `Card ${card} was dropped in ${target}.`,
  announceDropBack: (card) => `Card ${card} was dropped back to its position.`,
  announceCancel: (card) => `Dragging card ${card} was cancelled.`,
};

export const resolveLabels = (
  overrides?: Partial<KanbanLabels>
): KanbanLabels =>
  overrides ? { ...defaultLabels, ...overrides } : defaultLabels;
