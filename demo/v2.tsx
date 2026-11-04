// Backward-compatibility fixture: the library used exactly as the v2 README
// documented it. Note there is NO stylesheet import (v2 styled itself), the
// v2 props (columnForAddCard, onTaskAddedCallback, 2-argument onCardMove) and
// the v2 `Card` type. Driven by test/compat.spec.ts.
import React from "react";
import { createRoot } from "react-dom/client";
import KanbanBoard, { Card, Column } from "../src/index";

const columns: Column[] = [
  { title: "To Do", key: "todo", color: "#BDBDCD" },
  { title: "In Progress", key: "in-progress", color: "#FDDDE3", limit: 2 },
  { title: "Done", key: "done", color: "#71C781" },
];

const initialCards: Card[] = [
  { id: "1", title: "Task 1", status: "todo", priority: "High" },
  { id: "2", title: "Task 2", status: "todo", priority: "Low" },
  { id: "3", title: "Task 3", status: "in-progress" },
];

// v2 typed priority as a union; reading it must still type-check as one.
const priorityOf = (card: Card): "Low" | "Medium" | "High" | undefined => card.priority;

const App = () => (
  <KanbanBoard
    columns={columns}
    initialCards={initialCards}
    columnForAddCard="todo"
    enableSearch
    onCardMove={(cardId: string, newStatus: string) =>
      console.log("v2:onCardMove", cardId, newStatus)
    }
    onCardEdit={(cardId, newTitle) => console.log("v2:onCardEdit", cardId, newTitle)}
    onCardDelete={(cardId) => console.log("v2:onCardDelete", cardId)}
    onTaskAddedCallback={(title) => console.log("v2:onTaskAdded", title)}
    renderAvatar={() => null}
  />
);

void priorityOf;
createRoot(document.getElementById("root")!).render(<App />);
