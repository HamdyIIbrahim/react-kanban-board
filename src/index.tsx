import { useState, DragEvent, ReactNode } from "react";
import { motion } from "framer-motion";
import { ReactComponent as EditIcon } from "../public/assets/images/delete.svg";
import { ReactComponent as DeleteIcon } from "../public/assets/images/delete.svg";
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
                    <EditIcon width="20" height="20" />
                  </div>
                  <div onClick={() => handleDeleteCard(card.id)}>
                    <DeleteIcon width="23" height="23" />
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
                    <EditIcon width="20" height="20" />
                  </div>
                  <div onClick={() => handleDeleteCard(card.id)}>
                    <DeleteIcon width="23" height="23" />
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
