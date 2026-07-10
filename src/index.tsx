import React, {
  useState,
  DragEvent,
  ReactNode,
  useEffect,
  useRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./KanbanBoard.css";

export interface Card {
  id: string;
  title: string;
  status: string;
  avatarPath?: string;
  priority?: "Low" | "Medium" | "High";
  dueDate?: string;
  tags?: string[];
  description?: string;
  assignee?: string;
  [key: string]: any;
}

export interface Column {
  title: string;
  key: string;
  color: string;
  limit?: number; // Optional WIP limit
}

// New filter interfaces for dynamic filtering
export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  field: string;
  label: string;
  options: FilterOption[];
}

// Position information about where a card landed within its destination column,
// exposed through onCardMove so consumers can persist ordering on a backend.
export interface DropPosition {
  // Id of the card immediately before the dropped card in the destination
  // column, or null if it was dropped at the top.
  prevTaskId: string | null;
  // Id of the card immediately after the dropped card in the destination
  // column, or null if it was dropped at the bottom.
  nextTaskId: string | null;
  // Zero-based index of the dropped card within the destination column.
  index: number;
}

interface DefaultCardProps {
  title: string;
  avatarPath?: string;
  id: string;
  status: string;
  priority?: "Low" | "Medium" | "High";
  dueDate?: string;
  tags?: string[];
  description?: string;
  handleDragStart: (
    e: any,
    card: { title: string; id: string; status: string }
  ) => void;
  renderAvatar?: (avatarPath?: string) => ReactNode;
  children?: ReactNode;
  isExpanded?: boolean;
  toggleExpand?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
}

interface KanbanBoardProps {
  columns: Column[];
  initialCards: Card[];
  columnForAddCard: string;
  onCardMove?: (
    cardId: string,
    newStatus: string,
    position: DropPosition
  ) => void;
  onCardEdit?: (cardId: string, newTitle: string) => void;
  onCardDelete?: (cardId: string) => void;
  onTaskAddedCallback?: (title: string) => void;
  renderCard?: (
    card: Card,
    handleDragStart: (e: DragEvent<HTMLDivElement>, card: Card) => void,
    isExpanded?: boolean,
    toggleExpand?: (id: string) => void
  ) => ReactNode;
  renderAvatar?: (avatarPath?: string) => ReactNode;
  renderAddCard?: (
    column: string,
    setCards: React.Dispatch<React.SetStateAction<Card[]>>
  ) => ReactNode;
  isLoading?: boolean;
  loadingComponent?: ReactNode;
  emptyColumnMessage?: string;
  enableSearch?: boolean;
  enableFiltering?: boolean;
  filterConfigs?: FilterConfig[]; // New prop for custom filters
  onFilterChange?: (filters: Record<string, string | null>) => void; // Optional callback
  renderSearchInput?: (
    searchTerm: string,
    setSearchTerm: React.Dispatch<React.SetStateAction<string>>
  ) => ReactNode;
  renderFilterMenu?: (
    config: FilterConfig,
    value: string | null,
    handleFilterChange: (field: string, value: string | null) => void
  ) => ReactNode;
}

interface ColumnProps {
  title: string;
  column: string;
  cards: Card[];
  columnForAddCard: string;
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
  color: string;
  limit?: number;
  onCardMove?: (
    cardId: string,
    newStatus: string,
    position: DropPosition
  ) => void;
  onCardEdit?: (cardId: string, newTitle: string) => void;
  onCardDelete?: (cardId: string) => void;
  onTaskAddedCallback?: (title: string) => void;
  renderCard?: (
    card: Card,
    handleDragStart: (e: DragEvent<HTMLDivElement>, card: Card) => void,
    isExpanded?: boolean,
    toggleExpand?: (id: string) => void
  ) => ReactNode;
  renderAvatar?: (avatarPath?: string) => ReactNode;
  renderAddCard?: (
    column: string,
    setCards: React.Dispatch<React.SetStateAction<Card[]>>
  ) => ReactNode;
  emptyColumnMessage?: string;
  filteredCards: Card[];
}

interface AddCardProps {
  column: string;
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
  onTaskAddedCallback?: (title: string) => void;
}

// Enhanced Icon Components
const DeleteIcon = () => {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M19.5 5.5L18.8803 15.5251C18.7219 18.0864 18.6428 19.3671 18.0008 20.2879C17.6833 20.7431 17.2747 21.1273 16.8007 21.416C15.8421 22 14.559 22 12 22C9.44098 22 8.15402 22 7.19926 21.4159C6.72521 21.1271 6.31729 20.743 6.00058 20.2879C5.35858 19.3671 5.27812 18.0863 5.11963 15.525L4.5 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 5.5H21M16.0557 5.5L15.3731 4.09173C14.9196 3.15626 14.6928 2.68852 14.3017 2.39681C14.215 2.3321 14.1231 2.27454 14.027 2.2247C13.5939 2 13.0741 2 12.0345 2C10.9688 2 10.436 2 9.99568 2.23412C9.89809 2.28601 9.80498 2.3459 9.71729 2.41317C9.32163 2.7167 9.10062 3.20155 8.6586 4.17126L8.05292 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const EditIcon = () => {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M14.2454 5.05L15.9954 3.3C16.3954 2.9 16.9954 2.9 17.3954 3.3L20.6954 6.6C21.0954 7 21.0954 7.6 20.6954 8L8.69543 20C8.49543 20.2 8.19543 20.3 7.99543 20.3L3.69543 21L4.39543 16.7C4.39543 16.5 4.49543 16.2 4.69543 16L14.2454 5.05Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.2954 7L17.2954 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const SearchIcon = () => {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 21L16.65 16.65"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// New collapse/expand icon with animation
const CollapseExpandIcon = ({ isExpanded }: { isExpanded?: boolean }) => {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.3s ease",
      }}
      aria-hidden="true"
    >
      <path
        d="M7 10L12 15L17 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const LoadingSpinner = () => (
  <div className="loading-spinner">
    <div className="spinner"></div>
    <p>Loading board...</p>
  </div>
);

const KanbanBoard = ({
  columns,
  columnForAddCard,
  initialCards,
  onCardMove,
  onCardEdit,
  onCardDelete,
  onTaskAddedCallback,
  renderCard,
  renderAvatar,
  renderAddCard,
  isLoading = false,
  loadingComponent,
  emptyColumnMessage = "No cards yet",
  enableSearch = false,
  enableFiltering = false,
  filterConfigs = [],
  onFilterChange,
  renderSearchInput,
  renderFilterMenu,
}: KanbanBoardProps) => {
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<Record<string, string | null>>({});
  const [filteredCards, setFilteredCards] = useState<Card[]>(initialCards);

  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCards(initialCards);
  }, [initialCards]);

  // Handle filter change
  const handleFilterChange = (field: string, value: string | null) => {
    const newFilters = {
      ...filters,
      [field]: value || null,
    };

    // If value is empty, remove the filter
    if (!value) {
      delete newFilters[field];
    }

    setFilters(newFilters);
    onFilterChange?.(newFilters); // Notify parent component if callback exists
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilters({});
    onFilterChange?.({});
  };

  useEffect(() => {
    let result = [...cards];

    if (searchTerm) {
      result = result.filter((card) =>
        card.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply all active filters dynamically
    Object.entries(filters).forEach(([field, value]) => {
      if (value) {
        result = result.filter((card) => {
          // Handle special case for tags which is an array
          if (field === "tags" && Array.isArray(card.tags)) {
            return card.tags.includes(value);
          }
          // Standard field comparison
          return card[field] === value;
        });
      }
    });

    setFilteredCards(result);
  }, [searchTerm, filters, cards]);

  if (isLoading) {
    return (
      <div className="kanban-board-container">
        {loadingComponent || <LoadingSpinner />}
      </div>
    );
  }

  return (
    <div className="kanban-board-container" ref={boardRef}>
      {(enableSearch || (enableFiltering && filterConfigs.length > 0)) && (
        <div className="kanban-search">
          {enableSearch && (
            <>
              {renderSearchInput ? (
                renderSearchInput(searchTerm, setSearchTerm)
              ) : (
                <div className="search-input-wrapper">
                  <SearchIcon />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search cards..."
                    aria-label="Search cards"
                  />
                  {searchTerm && (
                    <button
                      className="clear-search"
                      onClick={() => setSearchTerm("")}
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {enableFiltering && filterConfigs.length > 0 && (
            <div className="filter-controls">
              {filterConfigs.map((config) => (
                <div key={config.field} className="filter-select-container">
                  {renderFilterMenu ? (
                    renderFilterMenu(
                      config,
                      filters[config.field] || null,
                      handleFilterChange
                    )
                  ) : (
                    <>
                      <label
                        htmlFor={`filter-${config.field}`}
                        className="filter-label"
                      >
                        {config.label}:
                      </label>
                      <select
                        id={`filter-${config.field}`}
                        value={filters[config.field] || ""}
                        onChange={(e) =>
                          handleFilterChange(
                            config.field,
                            e.target.value || null
                          )
                        }
                        aria-label={`Filter by ${config.label}`}
                      >
                        <option value="">All {config.label}s</option>
                        {config.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              ))}
              <button
                className="clear-filters"
                onClick={clearAllFilters}
                disabled={Object.keys(filters).length === 0}
                aria-label="Clear filters"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      )}

      <div className="kanban-board">
        {columns.map((column) => (
          <ColumnComponent
            key={column.key}
            title={column.title}
            column={column.key}
            cards={cards}
            filteredCards={filteredCards.filter(
              (card) => card.status === column.key
            )}
            setCards={setCards}
            color={column.color}
            limit={column.limit}
            onCardMove={onCardMove}
            onCardEdit={onCardEdit}
            onCardDelete={onCardDelete}
            renderCard={renderCard}
            renderAvatar={renderAvatar}
            renderAddCard={renderAddCard}
            onTaskAddedCallback={onTaskAddedCallback}
            columnForAddCard={columnForAddCard}
            emptyColumnMessage={emptyColumnMessage}
          />
        ))}
      </div>
    </div>
  );
};

const ColumnComponent: React.FC<ColumnProps> = ({
  title,
  column,
  cards,
  filteredCards,
  setCards,
  columnForAddCard,
  color,
  limit,
  onCardMove,
  onCardEdit,
  onCardDelete,
  renderCard,
  renderAvatar,
  renderAddCard,
  onTaskAddedCallback,
  emptyColumnMessage,
}) => {
  const [active, setActive] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState<string>("");
  const [expandedCards, setExpandedCards] = useState<{
    [key: string]: boolean;
  }>({});

  const columnRef = useRef<HTMLDivElement>(null);
  const isLimitExceeded = limit !== undefined && filteredCards.length > limit;

  const columnStyle = {
    backgroundColor: color,
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>, card: Card) => {
    e.dataTransfer.setData("cardId", card.id);

    // Create and set custom drag image
    const dragPreview = document.createElement("div");
    dragPreview.className = "card-drag-preview";
    dragPreview.textContent =
      card.title.length > 25 ? card.title.substring(0, 25) + "..." : card.title;
    document.body.appendChild(dragPreview);
    e.dataTransfer.setDragImage(dragPreview, 20, 20);

    // Remove after drag ends
    setTimeout(() => {
      if (document.body.contains(dragPreview)) {
        document.body.removeChild(dragPreview);
      }
    }, 0);
  };

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDragEnd = (e: DragEvent<HTMLDivElement>) => {
    const cardId = e.dataTransfer.getData("cardId");

    setActive(false);
    clearHighlights();

    // Get all drop indicators in the current column
    const indicators = getIndicators();

    // Find the nearest indicator based on mouse position
    const { element } = getNearestIndicator(e, indicators);

    // Get the ID of the card before which to insert the dragged card
    const before = element.dataset.before || "-1";

    // Only proceed if we're not trying to place the card in its original position
    if (before !== cardId) {
      let copy = [...cards];

      // Find the card being dragged
      const cardToMove = copy.find((c) => c.id === cardId);
      if (!cardToMove) return;

      // Get the current status of the card
      const currentStatus = cardToMove.status;
      const isSameColumn = currentStatus === column;

      // If moving to a different column, check column limits
      if (!isSameColumn && limit !== undefined) {
        const columnCardCount = copy.filter(
          (c) => c.status === column && c.id !== cardId
        ).length;

        // If moving to this column would exceed the limit
        if (columnCardCount >= limit) {
          showWipLimitNotification(columnRef.current);
          return;
        }
      }

      // Remove the card from its original position
      copy = copy.filter((c) => c.id !== cardId);

      // Create updated card with new status if column changed
      const updatedCard = isSameColumn
        ? cardToMove
        : { ...cardToMove, status: column };

      // Determine if we're adding the card to the end of the column
      const moveToBack = before === "-1";

      if (moveToBack) {
        // Add the card to the end of the array
        copy.push(updatedCard);
      } else {
        // Find the index where to insert the card
        const insertAtIndex = copy.findIndex((el) => el.id === before);
        if (insertAtIndex === -1) return; // Invalid index

        // Insert the card at the proper position
        copy.splice(insertAtIndex, 0, updatedCard);
      }

      // Update state
      setCards(copy);

      // Compute the final drop position within the destination column so
      // consumers can persist ordering (e.g. prev/next task ids) on a backend.
      const columnCards = copy.filter((c) => c.status === column);
      const indexInColumn = columnCards.findIndex((c) => c.id === cardId);
      const position: DropPosition = {
        prevTaskId: columnCards[indexInColumn - 1]?.id ?? null,
        nextTaskId: columnCards[indexInColumn + 1]?.id ?? null,
        index: indexInColumn,
      };

      // Fire the callback for both cross-column moves and same-column reorders.
      onCardMove?.(cardId, column, position);
    }
  };

  const showWipLimitNotification = (columnEl: HTMLDivElement | null) => {
    if (!columnEl) return;

    const notification = document.createElement("div");
    notification.className = "wip-limit-notification";
    notification.textContent = `WIP limit (${limit}) reached!`;

    columnEl.appendChild(notification);

    setTimeout(() => {
      notification.classList.add("show");

      setTimeout(() => {
        notification.classList.remove("show");
        setTimeout(() => {
          if (columnEl.contains(notification)) {
            columnEl.removeChild(notification);
          }
        }, 300);
      }, 2000);
    }, 10);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    highlightIndicator(e);
    setActive(true);
  };

  const clearHighlights = (els?: HTMLElement[]) => {
    const indicators = els || getIndicators();
    indicators.forEach((i: any) => {
      i.style.opacity = "0";
    });
  };

  const highlightIndicator = (e: DragEvent<HTMLDivElement>) => {
    const indicators = getIndicators();
    clearHighlights(indicators);
    const el = getNearestIndicator(e, indicators);
    el.element.style.opacity = "1";
  };

  // Improved getNearestIndicator for better accuracy in finding drop targets
  const getNearestIndicator = (
    e: DragEvent<HTMLDivElement>,
    indicators: HTMLElement[]
  ) => {
    const DISTANCE_OFFSET = 50;

    // Calculate the position of each indicator relative to mouse
    const el = indicators.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = e.clientY - (box.top + DISTANCE_OFFSET);

        // If this indicator is closer to the mouse than our current closest
        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } else {
          return closest;
        }
      },
      {
        offset: Number.NEGATIVE_INFINITY,
        element: indicators[indicators.length - 1],
      }
    );

    return el;
  };

  const handleDragLeave = () => {
    clearHighlights();
    setActive(false);
  };

  const getIndicators = (): HTMLElement[] => {
    return Array.from(document.querySelectorAll(`[data-column="${column}"]`));
  };

  const handleDeleteCard = (cardId: string) => {
    if (onCardDelete) onCardDelete(cardId);
    setCards((prevCards) => prevCards.filter((card) => card.id !== cardId));
  };

  const handleEditClick = (cardId: string, currentTitle: string) => {
    setEditingCardId(cardId);
    setNewTitle(currentTitle);
  };

  const handleSaveEdit = (cardId: string) => {
    if (newTitle.trim() === "") return;

    if (onCardEdit) onCardEdit(cardId, newTitle);
    setCards((prevCards) =>
      prevCards.map((card) =>
        card.id === cardId ? { ...card, title: newTitle } : card
      )
    );
    setEditingCardId(null);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTitle(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent, cardId: string) => {
    if (e.key === "Enter") {
      handleSaveEdit(cardId);
    } else if (e.key === "Escape") {
      setEditingCardId(null);
    }
  };

  return (
    <div
      className={`kanban-column ${active ? "active" : ""} ${
        isLimitExceeded ? "limit-exceeded" : ""
      }`}
      onDrop={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      ref={columnRef}
      data-testid={`column-${column}`}
    >
      <div className="column-title" style={columnStyle}>
        <div className="column-title-text">{title}</div>
        <div className="column-counter-container">
          <span className={`counter ${isLimitExceeded ? "exceeded" : ""}`}>
            {filteredCards.length}
            {limit !== undefined && `/${limit}`}
          </span>
        </div>
      </div>
      <div className={`column-content ${active ? "active" : ""}`}>
        {filteredCards.length === 0 ? (
          <div className="column-empty-state">{emptyColumnMessage}</div>
        ) : (
          <AnimatePresence>
            {filteredCards.map((card) => (
              <div className="motion-container" key={card.id}>
                <DropIndicator beforeId={card.id} column={column} />
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  data-card-id={card.id}
                  className="motion-card-wrapper"
                >
                  {editingCardId === card.id ? (
                    <div className="card-edit">
                      <input
                        autoFocus
                        type="text"
                        value={newTitle}
                        onChange={handleEditChange}
                        onBlur={() => handleSaveEdit(card.id)}
                        onKeyDown={(e) => handleKeyDown(e, card.id)}
                        aria-label="Edit card title"
                      />
                    </div>
                  ) : renderCard ? (
                    renderCard(
                      card,
                      handleDragStart,
                      expandedCards[card.id],
                      toggleExpand
                    )
                  ) : (
                    <DefaultCard
                      {...card}
                      handleDragStart={handleDragStart}
                      renderAvatar={renderAvatar}
                      isExpanded={expandedCards[card.id]}
                      toggleExpand={() => toggleExpand(card.id)}
                      onDelete={() => handleDeleteCard(card.id)}
                      onEdit={() => handleEditClick(card.id, card.title)}
                    />
                  )}
                </motion.div>
              </div>
            ))}
          </AnimatePresence>
        )}
        <DropIndicator beforeId={-1} column={column} />
        <div className="add-card-container">
          {columnForAddCard === column ? (
            renderAddCard ? (
              renderAddCard(column, setCards)
            ) : (
              <DefaultAddCard
                column={column}
                setCards={setCards}
                onTaskAddedCallback={onTaskAddedCallback}
              />
            )
          ) : null}
        </div>
      </div>
    </div>
  );
};

// Enhanced default card with better styling and icon positioning
const DefaultCard = ({
  title,
  avatarPath,
  id,
  status,
  priority,
  dueDate,
  tags,
  description,
  handleDragStart,
  renderAvatar,
  isExpanded,
  toggleExpand,
  onDelete,
  onEdit,
}: DefaultCardProps) => {
  const hasDetails =
    priority || dueDate || description || (tags && tags.length > 0);

  // Priority color mapping
  const priorityColors = {
    High: "#F87171",
    Medium: "#FBBF24",
    Low: "#34D399",
  };

  // Get border color based on priority
  const borderColor = priority ? priorityColors[priority] : undefined;

  return (
    <motion.div
      layout
      layoutId={id}
      className={`card ${isExpanded ? "expanded" : ""}`}
      draggable
      onDragStart={(e) => handleDragStart(e, { title, id, status })}
      style={{
        borderLeft: borderColor ? `4px solid ${borderColor}` : undefined,
      }}
      whileHover={{
        y: -2,
        boxShadow: "0 6px 16px rgba(0, 0, 0, 0.08)",
      }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 17,
      }}
      tabIndex={0}
      role="article"
      aria-label={`Card: ${title}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (toggleExpand) toggleExpand(id);
        }
      }}
    >
      <div className="card-header">
        <h3 className="card-title">
          {isExpanded || title.length <= 100
            ? title
            : `${title.substring(0, 100)}...`}
        </h3>

        <div className="card-actions">
          {onEdit && (
            <button
              className="card-action-button edit"
              onClick={() => onEdit(id)}
              aria-label="Edit card"
              type="button"
            >
              <EditIcon />
            </button>
          )}
          {onDelete && (
            <button
              className="card-action-button delete"
              onClick={() => onDelete(id)}
              aria-label="Delete card"
              type="button"
            >
              <DeleteIcon />
            </button>
          )}
        </div>
      </div>

      {priority && (
        <div className="priority-badge-container">
          <span className={`priority-badge ${priority.toLowerCase()}`}>
            {priority}
          </span>
        </div>
      )}

      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="card-details"
        >
          {description && (
            <div className="card-description">
              <p>{description}</p>
            </div>
          )}

          {dueDate && (
            <div className="card-detail">
              <span className="detail-label">Due:</span>
              <span className="detail-value">{dueDate}</span>
            </div>
          )}

          {tags && tags.length > 0 && (
            <div className="card-tags">
              {tags.map((tag) => (
                <span key={tag} className="card-tag">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </motion.div>
      )}

      <div className="card-footer">
        {renderAvatar
          ? renderAvatar(avatarPath)
          : avatarPath && <DefaultAvatar avatarPath={avatarPath} />}

        {hasDetails && toggleExpand && (
          <button
            onClick={() => toggleExpand(id)}
            className="expand-toggle"
            aria-label={isExpanded ? "Collapse card" : "Expand card"}
            type="button"
          >
            <CollapseExpandIcon isExpanded={isExpanded} />
          </button>
        )}
      </div>
    </motion.div>
  );
};

const DefaultAvatar = ({ avatarPath }: { avatarPath?: string }) => {
  if (!avatarPath) return null;
  return (
    <div className="avatar-container">
      <img src={avatarPath} alt="" className="avatar" loading="lazy" />
    </div>
  );
};

const DefaultAddCard = ({
  column,
  setCards,
  onTaskAddedCallback,
}: AddCardProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  // Handle form submission for new card
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim()) {
      const newCard: Card = {
        id: `card-${Date.now()}`,
        title: newTitle,
        status: column,
      };
      setCards((prev) => [...prev, newCard]);
      setNewTitle("");
      setIsAdding(false);
      onTaskAddedCallback?.(newTitle);
    }
  };

  // Improved rendering to ensure proper overflow handling
  return isAdding ? (
    <div className="add-card-motion-container">
      <motion.form
        onSubmit={handleSubmit}
        className="add-card-form"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="add-card-input-container">
          <input
            type="text"
            className="add-card-input"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Enter card title..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsAdding(false);
              }
            }}
            aria-label="New card title"
            maxLength={200} // Prevent extremely long titles
          />
        </div>
        <div className="add-card-buttons">
          <button type="submit" disabled={!newTitle.trim()}>
            Add Card
          </button>
          <button type="button" onClick={() => setIsAdding(false)}>
            Cancel
          </button>
        </div>
      </motion.form>
    </div>
  ) : (
    <motion.div
      className="add-card"
      onClick={() => setIsAdding(true)}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      role="button"
      tabIndex={0}
      aria-label="Add new card"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          setIsAdding(true);
        }
      }}
    >
      <span>+</span> Add Card
    </motion.div>
  );
};

const DropIndicator = ({
  beforeId,
  column,
}: {
  beforeId: string | number;
  column: string;
}) => {
  return (
    <div
      data-before={beforeId}
      data-column={column}
      className="drop-indicator"
      aria-hidden="true"
    />
  );
};

export default KanbanBoard;
