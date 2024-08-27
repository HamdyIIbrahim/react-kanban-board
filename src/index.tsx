import { useState, DragEvent, ReactNode } from "react";
import { motion } from "framer-motion";
import "./KanbanBoard.css";

export interface Card {
  id: string;
  title: string;
  status: string;
  avatarPath?: string;
}
export interface Column {
  title: string;
  key: string;
  color: string;
}

interface DefaultCardProps {
  title: string;
  avatarPath?: string;
  id: string;
  status: string;
  handleDragStart: (
    e: any,
    card: { title: string; id: string; status: string }
  ) => void;
  renderAvatar?: (avatarPath?: string) => ReactNode;
  children?: ReactNode;
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
    handleDragStart: (e: DragEvent<HTMLDivElement>, card: Card) => void
  ) => ReactNode;
  renderAvatar?: (avatarPath?: string) => ReactNode;
  renderAddCard?: (
    column: string,
    setCards: React.Dispatch<React.SetStateAction<Card[]>>
  ) => ReactNode;
}
interface ColumnProps {
  title: string;
  column: string;
  cards: Card[];
  columnForAddCard: string;
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
  color: string;
  onCardMove?: (cardId: string, newStatus: string) => void;
  onCardEdit?: (cardId: string, newTitle: string) => void;
  onCardDelete?: (cardId: string) => void;
  onTaskAddedCallback?: (title: string) => void;
  renderCard?: (
    card: Card,
    handleDragStart: (e: DragEvent<HTMLDivElement>, card: Card) => void
  ) => ReactNode;
  renderAvatar?: (avatarPath?: string) => ReactNode;
  renderAddCard?: (
    column: string,
    setCards: React.Dispatch<React.SetStateAction<Card[]>>
  ) => ReactNode;
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
}: KanbanBoardProps) => {
  const [cards, setCards] = useState<Card[]>(initialCards);

  return (
    <div className="kanban-board">
      {columns.map((column) => (
        <ColumnComponent
          key={column.key}
          title={column.title}
          column={column.key}
          cards={cards}
          setCards={setCards}
          color={column.color}
          onCardMove={onCardMove}
          onCardEdit={onCardEdit}
          onCardDelete={onCardDelete}
          renderCard={renderCard}
          renderAvatar={renderAvatar}
          renderAddCard={renderAddCard}
          onTaskAddedCallback={onTaskAddedCallback}
          columnForAddCard={columnForAddCard}
        />
      ))}
    </div>
  );
};

const ColumnComponent: React.FC<ColumnProps> = ({
  title,
  column,
  cards,
  setCards,
  columnForAddCard,
  color,
  onCardMove,
  onCardEdit,
  onCardDelete,
  renderCard,
  renderAvatar,
  renderAddCard,
  onTaskAddedCallback,
}) => {
  const filteredCards = cards.filter((card) => card.status === column);
  const [active, setActive] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState<string>("");
  const handleDragStart = (e: DragEvent<HTMLDivElement>, card: Card) => {
    e.dataTransfer.setData("cardId", card.id);
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
  return (
    <div
      className={`kanban-column ${active ? "active" : ""}`}
      onDrop={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="column-title" style={{ backgroundColor: color }}>
        {title} <span className="counter">{filteredCards.length}</span>
      </div>
      <div className={`column-content ${active ? "active" : ""}`}>
        {filteredCards.map((card) => (
          <div key={card.id}>
            <DropIndicator beforeId={card.id} column={column} />
            {editingCardId === card.id ? (
              <div className="card-edit">
                <input
                  autoFocus
                  type="text"
                  value={newTitle}
                  onChange={handleEditChange}
                  onBlur={() => handleSaveEdit(card.id)}
                />
              </div>
            ) : renderCard ? (
              <>
                {renderCard(card, handleDragStart)}
                <div className="card-actions">
                  <div onClick={() => handleEditClick(card.id, card.title)}>
                    <EditIcon  />
                  </div>
                  <div onClick={() => handleDeleteCard(card.id)}>
                    <DeleteIcon  />
                  </div>
                </div>
              </>
            ) : (
              <DefaultCard
                {...card}
                handleDragStart={handleDragStart}
                renderAvatar={renderAvatar}
              >
                {" "}
                <div className="card-actions">
                  <div onClick={() => handleEditClick(card.id, card.title)}>
                    <EditIcon  />
                  </div>
                  <div onClick={() => handleDeleteCard(card.id)}>
                    <DeleteIcon  />
                  </div>
                </div>
              </DefaultCard>
            )}
          </div>
        ))}
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
  handleDragStart,
  renderAvatar,
  children,
}: DefaultCardProps) => {
  return (
    <motion.div
      layout
      layoutId={id}
      draggable="true"
      onDragStart={(e) => handleDragStart(e, { title, id, status })}
      className="card"
    >
      <div className="card-info">
        <p>{title}</p>
        {renderAvatar ? (
          renderAvatar(avatarPath)
        ) : (
          <DefaultAvatar avatarPath={avatarPath} />
        )}
      </div>
      {children}
    </motion.div>
  );
};

const DefaultAvatar = ({ avatarPath }: { avatarPath?: string }) => {
  if (!avatarPath) return null;

  return (
    <img
      src={avatarPath}
      alt={`img ${avatarPath}`}
      className="avatar"
      style={{ borderRadius: "50%", width: "40px", height: "40px" }}
    />
  );
};

const DefaultAddCard = ({
  column,
  setCards,
  onTaskAddedCallback,
}: AddCardProps) => {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    setCards((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        title,
        status: column,
      },
    ]);
    if (onTaskAddedCallback) onTaskAddedCallback(title);
    setTitle("");
    setAdding(false);
  };

  return (
    <>
      {adding ? (
        <motion.form layout onSubmit={handleAddCard} className="add-card-form">
          <textarea
            rows={3}
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a card..."
          />
          <div className="add-card-actions">
            <span className="close-btn" onClick={() => setAdding(false)}>
              Close
            </span>
            <button className="submit-btn" type="submit">
              + Add
            </button>
          </div>
        </motion.form>
      ) : (
        <motion.button
          layout
          onClick={() => setAdding(true)}
          className="add-card"
        >
          <span>Add card +</span>
        </motion.button>
      )}
    </>
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
    ></div>
  );
};

export default KanbanBoard;
