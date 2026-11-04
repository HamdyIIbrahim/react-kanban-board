// Compile-only check of the published type declarations (npm run test:types).
import React from "react";
import KanbanBoard, {
  ControlledKanbanBoard,
  useKanban,
  type BaseCard,
  type Column,
  type KanbanLabels,
} from "react-custom-kanban-board";
import { moveCard, exportCardsToCSV } from "react-custom-kanban-board/utils";

interface Ticket extends BaseCard {
  storyPoints: number;
  epic: "auth" | "billing";
}

const columns: Column[] = [{ key: "todo", title: "To Do", color: "#ccc", allowAddCard: true }];
const tickets: Ticket[] = [
  { id: "1", title: "A", status: "todo", storyPoints: 3, epic: "auth" },
];
const labels: Partial<KanbanLabels> = { addCard: "Ajouter", wipReached: (n) => `max ${n}` };

export const Typed = () => (
  <KanbanBoard<Ticket>
    columns={columns}
    initialCards={tickets}
    swimlaneBy="epic"
    labels={labels}
    dir="rtl"
    onCardUpdate={(id, patch) => {
      const points: number | undefined = patch.storyPoints;
      void id;
      void points;
    }}
    renderCard={(card, _dragging, _expanded, _toggle, actions) => (
      <div onDoubleClick={actions?.openDetails}>{card.epic}</div>
    )}
  />
);

export const Loose = () => (
  <ControlledKanbanBoard
    columns={columns}
    cards={[{ id: "1", title: "x", status: "todo", anything: 1 }]}
    onCardsChange={() => {}}
  />
);

export function Headless() {
  const kanban = useKanban<Ticket>({ columns, initialCards: tickets });
  const r = kanban.moveCard("1", "todo", 0);
  if (r.ok) r.position.index.toFixed();
  const created: Ticket = kanban.addCard("todo", { title: "B", storyPoints: 1, epic: "billing" });
  void created;
  return <>{kanban.getColumnCards("todo").map((c) => c.storyPoints)}</>;
}

const moved = moveCard(tickets, "1", "todo");
if (moved && "nextCards" in moved) moved.nextCards[0].epic satisfies Ticket["epic"];
exportCardsToCSV(tickets);

// @ts-expect-error swimlaneBy must be a key of the card type
export const Bad = () => <KanbanBoard<Ticket> columns={columns} swimlaneBy="nope" />;
