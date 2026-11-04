// Code written against the published v2 typings must still compile.
import React, { DragEvent } from "react";
import KanbanBoard, { Card, Column, FilterConfig, FilterOption } from "react-custom-kanban-board";

const columns: Column[] = [{ title: "To Do", key: "todo", color: "#ccc", limit: 3 }];
const cards: Card[] = [{ id: "1", title: "A", status: "todo", priority: "High", custom: 1 }];

// v2: priority is a union and color a plain string.
const p: "Low" | "Medium" | "High" | undefined = cards[0].priority;
const c: string = columns[0].color;
const options: FilterOption[] = [{ value: "High", label: "High" }];
const filters: FilterConfig[] = [{ field: "priority", label: "Priority", options }];

// v2 renderCard signature with the native drag handler.
const renderCard = (
  card: Card,
  handleDragStart: (e: DragEvent<HTMLDivElement>, card: Card) => void,
  isExpanded?: boolean,
  toggleExpand?: (id: string) => void
) => (
  <div draggable onDragStart={(e) => handleDragStart(e, card)} onClick={() => toggleExpand?.(card.id)}>
    {card.title} {isExpanded ? "open" : ""}
  </div>
);

export const V2 = () => (
  <KanbanBoard
    columns={columns}
    initialCards={cards}
    columnForAddCard="todo"
    onCardMove={(cardId: string, newStatus: string) => void [cardId, newStatus]}
    onCardEdit={(cardId: string, newTitle: string) => void [cardId, newTitle]}
    onCardDelete={(cardId: string) => void cardId}
    onTaskAddedCallback={(title: string) => void title}
    renderCard={renderCard}
    renderAvatar={(avatarPath?: string) => <img src={avatarPath} alt="" />}
    renderAddCard={(column, setCards) => (
      <button onClick={() => setCards((prev) => [...prev, { id: "x", title: "x", status: column }])}>+</button>
    )}
    isLoading={false}
    loadingComponent={<span />}
    emptyColumnMessage="Empty"
    enableSearch
    enableFiltering
    filterConfigs={filters}
    onFilterChange={(f: Record<string, string | null>) => void f}
    renderSearchInput={(term, setTerm) => <input value={term} onChange={(e) => setTerm(e.target.value)} />}
    renderFilterMenu={(config, value, onChange) => (
      <select value={value ?? ""} onChange={(e) => onChange(config.field, e.target.value || null)} />
    )}
  />
);

void [p, c];
