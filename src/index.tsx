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
}

interface KanbanBoardProps {
  columns: Column[];
  initialCards: Card[];
  columnForAddCard: string;
  onCardMove?: (cardId: string, newStatus: string) => void;
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
  theme?: {
    backgroundColor?: string;
    columnBackgroundColor?: string;
    cardBackgroundColor?: string;
    textColor?: string;
    accentColor?: string;
    borderRadius?: string;
  };
  isLoading?: boolean;
  loadingComponent?: ReactNode;
  emptyColumnMessage?: string;
  enableSearch?: boolean;
  enableFiltering?: boolean;
}

interface ColumnProps {
  title: string;
  column: string;
  cards: Card[];
  columnForAddCard: string;
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
  color: string;
  limit?: number;
  onCardMove?: (cardId: string, newStatus: string) => void;
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

const DeleteIcon = () => {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M10 11V17"
        stroke="#F11D42"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 11V17"
        stroke="#F11D42"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 7H20"
        stroke="#F11D42"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 7H12H18V18C18 19.6569 16.6569 21 15 21H9C7.34315 21 6 19.6569 6 18V7Z"
        stroke="#F11D42"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5V7H9V5Z"
        stroke="#F11D42"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const EditIcon = () => {
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
        d="M21.2799 6.40005L11.7399 15.94C10.7899 16.89 7.96987 17.33 7.33987 16.7C6.70987 16.07 7.13987 13.25 8.08987 12.3L17.6399 2.75002C17.8754 2.49308 18.1605 2.28654 18.4781 2.14284C18.7956 1.99914 19.139 1.92124 19.4875 1.9139C19.8359 1.90657 20.1823 1.96991 20.5056 2.10012C20.8289 2.23033 21.1225 2.42473 21.3686 2.67153C21.6147 2.91833 21.8083 3.21243 21.9376 3.53609C22.0669 3.85976 22.1294 4.20626 22.1211 4.55471C22.1128 4.90316 22.0339 5.24635 21.8894 5.5635C21.7448 5.88065 21.5375 6.16524 21.2799 6.40005V6.40005Z"
        stroke="#000000"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 4H6C4.93913 4 3.92178 4.42142 3.17163 5.17157C2.42149 5.92172 2 6.93913 2 8V18C2 19.0609 2.42149 20.0783 3.17163 20.8284C3.92178 21.5786 4.93913 22 6 22H17C19.21 22 20 20.2 20 18V13"
        stroke="#000000"
        strokeWidth="1.5"
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
        stroke="#000000"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 21L16.65 16.65"
        stroke="#000000"
        strokeWidth="2"
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
  theme = {},
  isLoading = false,
  loadingComponent,
  emptyColumnMessage = "No cards yet",
  enableSearch = false,
  enableFiltering = false,
}: KanbanBoardProps) => {
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<{
    priority?: string | null;
    tags?: string[] | null;
  }>({});
  const [filteredCards, setFilteredCards] = useState<Card[]>(initialCards);

  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCards(initialCards);
  }, [initialCards]);

  useEffect(() => {
    let result = [...cards];

    if (searchTerm) {
      result = result.filter((card) =>
        card.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filters.priority) {
      result = result.filter((card) => card.priority === filters.priority);
    }

    if (filters.tags && filters.tags.length > 0) {
      result = result.filter((card) =>
        card.tags?.some((tag) => filters.tags?.includes(tag))
      );
    }

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
      {enableSearch && (
        <div className="kanban-search">
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

          {enableFiltering && (
            <div className="filter-controls">
              <select
                value={filters.priority || ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    priority: e.target.value || null,
                  })
                }
                aria-label="Filter by priority"
              >
                <option value="">All Priorities</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
              <button
                className="clear-filters"
                onClick={() => setFilters({})}
                disabled={!filters.priority && !filters.tags?.length}
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

    const indicators = getIndicators();
    const { element } = getNearestIndicator(e, indicators);

    const before = element.dataset.before || "-1";

    if (before !== cardId) {
      let copy = [...cards];

      let cardToTransfer = copy.find((c) => c.id === cardId);
      if (!cardToTransfer) return;

      // Check if the column has a limit
      if (limit !== undefined) {
        const columnCardCount = copy.filter(
          (c) => c.status === column && c.id !== cardId
        ).length;

        // If moving to this column would exceed the limit
        if (cardToTransfer.status !== column && columnCardCount >= limit) {
          // Show WIP limit exceeded notification
          showWipLimitNotification(columnRef.current);
          return;
        }
      }

      cardToTransfer = { ...cardToTransfer, status: column };

      copy = copy.filter((c) => c.id !== cardId);

      const moveToBack = before === "-1";

      if (moveToBack) {
        copy.push(cardToTransfer);
      } else {
        const insertAtIndex = copy.findIndex((el) => el.id === before);
        if (insertAtIndex === undefined) return;

        copy.splice(insertAtIndex, 0, cardToTransfer);
      }

      setCards(copy);
      onCardMove?.(cardId, column);
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

  const getNearestIndicator = (
    e: DragEvent<HTMLDivElement>,
    indicators: HTMLElement[]
  ) => {
    const DISTANCE_OFFSET = 50;
    const el = indicators.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = e.clientY - (box.top + DISTANCE_OFFSET);
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
      <div className="column-title" style={{ backgroundColor: color }}>
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
              <motion.div
                key={card.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                data-card-id={card.id}
              >
                <DropIndicator beforeId={card.id} column={column} />
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
                  <div className="card-wrapper">
                    {renderCard(
                      card,
                      handleDragStart,
                      expandedCards[card.id],
                      toggleExpand
                    )}
                    <div className="card-actions" aria-label="Card actions">
                      <div
                        onClick={() => handleEditClick(card.id, card.title)}
                        title="Edit card"
                        role="button"
                        tabIndex={0}
                        aria-label="Edit card"
                      >
                        <EditIcon />
                      </div>
                      <div
                        onClick={() => handleDeleteCard(card.id)}
                        title="Delete card"
                        role="button"
                        tabIndex={0}
                        aria-label="Delete card"
                      >
                        <DeleteIcon />
                      </div>
                    </div>
                  </div>
                ) : (
                  <DefaultCard
                    {...card}
                    handleDragStart={handleDragStart}
                    renderAvatar={renderAvatar}
                    isExpanded={expandedCards[card.id]}
                    toggleExpand={() => toggleExpand(card.id)}
                  >
                    <div className="card-actions">
                      <div
                        onClick={() => handleEditClick(card.id, card.title)}
                        title="Edit card"
                        role="button"
                        tabIndex={0}
                        aria-label="Edit card"
                      >
                        <EditIcon />
                      </div>
                      <div
                        onClick={() => handleDeleteCard(card.id)}
                        title="Delete card"
                        role="button"
                        tabIndex={0}
                        aria-label="Delete card"
                      >
                        <DeleteIcon />
                      </div>
                    </div>
                  </DefaultCard>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <DropIndicator beforeId={-1} column={column} />
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
  );
};

const DefaultCard = ({
  title,
  avatarPath,
  id,
  status,
  priority,
  dueDate,
  description,
  handleDragStart,
  renderAvatar,
  children,
  isExpanded,
  toggleExpand,
}: DefaultCardProps) => {
  const hasDetails = priority || dueDate || description;

  return (
    <motion.div
      layout
      layoutId={id}
      className={`card ${isExpanded ? "expanded" : ""}`}
      draggable
      onDragStart={(e) => handleDragStart(e, { title, id, status })}
      whileHover={{
        y: -4,
        boxShadow: "0 6px 16px rgba(34, 139, 230, 0.18)",
      }}
      transition={{ type: "spring", stiffness: 300 }}
      tabIndex={0}
      role="article"
      aria-label={`Card: ${title}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (toggleExpand) toggleExpand(id);
        }
      }}
    >
      <div className="card-info">
        <p>
          {isExpanded || title.length <= 100
            ? title
            : `${title.substring(0, 100)}...`}
        </p>

        {/* Standardized avatar position */}
        <div className="card-footer">
          {renderAvatar
            ? renderAvatar(avatarPath)
            : avatarPath && <DefaultAvatar avatarPath={avatarPath} />}

          {hasDetails && toggleExpand && (
            <button
              onClick={() => toggleExpand(id)}
              className="expand-toggle"
              aria-label={isExpanded ? "Collapse card" : "Expand card"}
            >
              {isExpanded ? "▲" : "▼"}
            </button>
          )}
        </div>

        {/* Card details moved below avatar for consistency */}
        {hasDetails && isExpanded && (
          <div className="card-details">
            {priority && (
              <div className="card-detail">
                <span className="detail-label">Priority:</span>
                <span className={`priority-badge ${priority.toLowerCase()}`}>
                  {priority}
                </span>
              </div>
            )}

            {dueDate && (
              <div className="card-detail">
                <span className="detail-label">Due:</span>
                <span className="due-date">{dueDate}</span>
              </div>
            )}

            {description && (
              <div className="card-description">
                <span className="detail-label">Description:</span>
                <p>{description}</p>
              </div>
            )}
          </div>
        )}
      </div>
      {children}
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsAdding(false);
    }
  };

  return isAdding ? (
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
          onKeyDown={handleKeyDown}
          aria-label="New card title"
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
