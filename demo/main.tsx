import React from "react";
import { createRoot } from "react-dom/client";
import { useState } from "react";
import KanbanBoard, {
  Column,
  Card,
  FilterConfig,
  DropPosition,
  DeleteConfirmation,
} from "../src/index";

const params = new URLSearchParams(window.location.search);
const deleteMode = (params.get("delete") || "immediate") as DeleteConfirmation;
const loadingCols = (params.get("loadingCols") || "").split(",").filter(Boolean);
const emptyCols = (params.get("emptyCols") || "").split(",").filter(Boolean);

const columns: Column[] = [
  { title: "To Do", key: "todo", color: "#B8C2CC" },
  { title: "In Progress", key: "in-progress", color: "#FFB1C1", limit: 3 },
  { title: "Review", key: "review", color: "#FFD580" },
  {
    title: "Done",
    key: "done",
    color: "#91D18B",
    emptyMessage: "Nothing shipped yet 🚀",
  },
].map((c) => ({
  ...c,
  isLoading: loadingCols.includes(c.key),
})) as Column[];

const initialCards: Card[] = [
  {
    id: "1",
    title: "Create user authentication flow",
    status: "todo",
    avatarPath: "https://i.pravatar.cc/40?img=1",
    priority: "High",
    dueDate: "2026-07-30",
    tags: ["frontend", "auth"],
    description: "Implement user registration, login, and password reset flows.",
    assignee: "john",
  },
  {
    id: "2",
    title: "Design database schema",
    status: "todo",
    avatarPath: "https://i.pravatar.cc/40?img=2",
    priority: "Medium",
    dueDate: "2026-07-22",
    tags: ["backend", "database"],
    description: "Define tables, relationships, and indexes for the app.",
    assignee: "sara",
  },
  {
    id: "3",
    title: "Set up CI/CD pipeline",
    status: "in-progress",
    avatarPath: "https://i.pravatar.cc/40?img=3",
    priority: "High",
    dueDate: "2026-07-18",
    tags: ["devops"],
    description: "Configure GitHub Actions for build, test, and deploy.",
    assignee: "mike",
  },
  {
    id: "4",
    title: "Write API documentation",
    status: "review",
    avatarPath: "https://i.pravatar.cc/40?img=4",
    priority: "Low",
    dueDate: "2026-07-25",
    tags: ["docs"],
    description: "Document all REST endpoints with examples.",
    assignee: "sara",
  },
  {
    id: "5",
    title: "Deploy landing page",
    status: "done",
    avatarPath: "https://i.pravatar.cc/40?img=5",
    priority: "Medium",
    dueDate: "2026-07-05",
    tags: ["frontend"],
    description: "Ship the marketing landing page to production.",
    assignee: "john",
  },
];

const filterConfigs: FilterConfig[] = [
  {
    field: "priority",
    label: "Priority",
    options: [
      { value: "High", label: "High Priority" },
      { value: "Medium", label: "Medium Priority" },
      { value: "Low", label: "Low Priority" },
    ],
  },
  {
    field: "assignee",
    label: "Assignee",
    options: [
      { value: "john", label: "John" },
      { value: "sara", label: "Sara" },
      { value: "mike", label: "Mike" },
    ],
  },
];

const App = () => {
  const [lastMove, setLastMove] = useState<string>(
    "Drag a card to see the onCardMove payload here."
  );

  const handleCardMove = (
    cardId: string,
    newStatus: string,
    position: DropPosition
  ) => {
    const payload = { cardId, newStatus, ...position };
    // eslint-disable-next-line no-console
    console.log("onCardMove:", payload);
    setLastMove(JSON.stringify(payload, null, 0));
  };

  const handleCardDelete = (cardId: string) => {
    // eslint-disable-next-line no-console
    console.log("onCardDelete:", cardId);
    setLastMove(JSON.stringify({ deleted: cardId }));
  };

  return (
    <div>
      <header className="app-header">
        <h1>Project Task Board</h1>
        <pre
          style={{
            margin: "10px 0 0",
            padding: "8px 12px",
            background: "#172b4d",
            color: "#7ee787",
            borderRadius: 6,
            fontSize: 13,
            overflowX: "auto",
          }}
        >
          {lastMove}
        </pre>
      </header>
      <main className="board-container">
        <KanbanBoard
          columns={columns}
          initialCards={initialCards.filter(
            (c) => !emptyCols.includes(c.status)
          )}
          columnForAddCard="todo"
          emptyColumnMessage="No tasks yet"
          enableSearch={true}
          enableFiltering={true}
          filterConfigs={filterConfigs}
          onCardMove={handleCardMove}
          onCardDelete={handleCardDelete}
          deleteConfirmation={deleteMode}
          undoDuration={3000}
          renderColumnLoading={
            params.get("customLoading")
              ? (col) => (
                  <div data-testid={`custom-loading-${col.key}`}>
                    Loading {col.title}…
                  </div>
                )
              : undefined
          }
        />
      </main>
    </div>
  );
};

createRoot(document.getElementById("root")!).render(<App />);
