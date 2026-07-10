import React, { useState, useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import { motion, AnimatePresence } from "framer-motion";
import KanbanBoard, {
  Column,
  Card,
  FilterConfig,
  DropPosition,
  DeleteConfirmation,
  ControlledKanbanBoard,
} from "../src/index";
import "./showcase.css";

/* ---------------------------------------------------------------------------
   URL params still drive the initial state so the Playwright suite keeps
   working (?mode, ?delete, ?loadingCols, ?emptyCols, ?wip, ?bulk, ?virtualize,
   ?customLoading). The on-screen controls just mutate the same state.
--------------------------------------------------------------------------- */
const params = new URLSearchParams(window.location.search);
const initialDelete = (params.get("delete") || "immediate") as DeleteConfirmation;
const initialMode = params.get("mode") || "uncontrolled";
const initialLoading = (params.get("loadingCols") || "")
  .split(",")
  .filter(Boolean);
const emptyCols = (params.get("emptyCols") || "").split(",").filter(Boolean);
const wipLimit = params.get("wip") ? Number(params.get("wip")) : 3;
const initialBulk = params.get("bulk") ? Number(params.get("bulk")) : 0;
const initialVirtualize = params.get("virtualize")
  ? Number(params.get("virtualize"))
  : undefined;
const customLoadingParam = params.get("customLoading");

const baseColumns: Column[] = [
  { title: "To Do", key: "todo", color: "#B8C2CC" },
  { title: "In Progress", key: "in-progress", color: "#FFB1C1", limit: wipLimit },
  { title: "Review", key: "review", color: "#FFD580" },
  {
    title: "Done",
    key: "done",
    color: "#91D18B",
    emptyMessage: "Nothing shipped yet 🚀",
  },
];

const baseCards: Card[] = [
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

const makeBulk = (n: number): Card[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `bulk-${i}`,
    title: `Bulk task ${i + 1}`,
    status: "todo",
    priority: (["High", "Medium", "Low"] as const)[i % 3],
    assignee: (["john", "sara", "mike"] as const)[i % 3],
  }));

/* ---------- little inline icons ---------- */
const Ic = ({ d, style }: { d: string; style?: React.CSSProperties }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    style={style}
  >
    <path d={d} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const icons = {
  touch: "M9 11V6a2 2 0 1 1 4 0v5m0 0V4a2 2 0 1 1 4 0v7m0 0a2 2 0 1 1 4 0v3a7 7 0 0 1-7 7h-2a7 7 0 0 1-6-3.5L4 15",
  key: "M15 7a4 4 0 1 0-4 4M11 11 4 18v3h3l1-1v-2h2l1-1v-2l2-2",
  undo: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  bolt: "M13 2 3 14h7l-1 8 10-12h-7l1-8Z",
  scale: "M3 3v18h18M7 15l4-4 3 3 5-6",
  lock: "M6 10V7a6 6 0 1 1 12 0v3M4 10h16v11H4z",
};

/* =========================================================================
   View presets — Default (built-in), CRM (like a polished lead board),
   Compact (dense rows), and Table (a list view). Selected via ?view= and the
   playground's View switcher. Only "default" is used by the test suite, so the
   presets never affect testids/behaviour.
========================================================================= */
type ViewKind = "default" | "crm" | "compact" | "table";
const initialView = (params.get("view") || "default") as ViewKind;

// Deterministic gradient (like the reference avatars) from any seed string.
const gradientFor = (seed: string) => {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `linear-gradient(135deg, hsl(${h} 85% 62%), hsl(${(h + 55) % 360} 82% 52%))`;
};
const nameFor = (a?: string) => (a ? a[0].toUpperCase() + a.slice(1) : "Unassigned");
const dueLabel = (d?: string) => {
  if (!d) return null;
  const [, m, day] = d.split("-");
  const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  return `${months[Number(m) - 1]} ${Number(day)}`;
};
const priDot: Record<string, string> = {
  High: "#ef4444",
  Medium: "#f59e0b",
  Low: "#10b981",
};

// Richer sample cards for the non-default views (never seen by tests).
const showcaseExtras: Card[] = [
  { id: "x1", title: "Refactor billing service", status: "todo", assignee: "mike", priority: "Medium", dueDate: "2026-08-04", description: "Split the monolithic billing module into invoice + payment services.", comments: 6 },
  { id: "x2", title: "A/B test new onboarding", status: "in-progress", assignee: "sara", priority: "Low", dueDate: "2026-08-12", description: "Measure activation lift from the 3-step vs 5-step onboarding.", comments: 12 },
  { id: "x3", title: "SOC 2 evidence collection", status: "review", assignee: "john", priority: "High", dueDate: "2026-07-29", description: "Gather access-control and change-management evidence for the auditor.", comments: 3 },
  { id: "x4", title: "Migrate analytics to warehouse", status: "review", assignee: "mike", priority: "Medium", dueDate: "2026-08-20", description: "Move event pipeline into the ClickHouse warehouse.", comments: 9 },
  { id: "x5", title: "Launch pricing page v2", status: "done", assignee: "sara", priority: "High", dueDate: "2026-07-02", description: "Ship the redesigned pricing page with annual toggle.", comments: 21 },
  { id: "x6", title: "Fix flaky e2e suite", status: "done", assignee: "john", priority: "Low", dueDate: "2026-06-28", description: "Stabilise the drag-and-drop specs on CI.", comments: 4 },
];

const CalIc = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.9">
    <rect x="3" y="4.5" width="18" height="17" rx="2.5" /><path d="M3 9h18M8 2.5v4M16 2.5v4" strokeLinecap="round" />
  </svg>
);
const ChatIc = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.9">
    <path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-6.5A8 8 0 1 1 21 12Z" strokeLinejoin="round" />
  </svg>
);

const Avatar = ({ seed, path }: { seed: string; path?: string }) =>
  path ? (
    <img className="av-img" src={path} alt="" loading="lazy" />
  ) : (
    <span className="av-grad" style={{ background: gradientFor(seed) }} />
  );

// CRM lead-card renderer (matches the polished reference board).
const crmCard = (card: Card, isDragging?: boolean) => (
  <div className={`crm-card ${isDragging ? "is-dragging" : ""}`}>
    <div className="crm-top">
      <h4 className="crm-title">{card.title}</h4>
      {card.priority && (
        <span
          className="crm-status"
          title={card.priority}
          style={{ background: priDot[card.priority] }}
        />
      )}
    </div>
    {card.description && <p className="crm-desc">{card.description}</p>}
    <div className="crm-foot">
      <span className="crm-who">
        <Avatar seed={card.assignee || card.id} path={card.avatarPath} />
        {nameFor(card.assignee)}
      </span>
      <span className="crm-meta">
        {card.dueDate && (
          <span className="crm-chip">
            <CalIc /> {dueLabel(card.dueDate)}
          </span>
        )}
        <span className="crm-chip">
          <ChatIc /> {card.comments ?? card.tags?.length ?? 0}
        </span>
      </span>
    </div>
  </div>
);

// Compact / dense renderer.
const compactCard = (card: Card, isDragging?: boolean) => (
  <div className={`cmp-card ${isDragging ? "is-dragging" : ""}`}>
    <span
      className="cmp-pri"
      style={{ background: card.priority ? priDot[card.priority] : "#cbd5e1" }}
    />
    <span className="cmp-title">{card.title}</span>
    <Avatar seed={card.assignee || card.id} path={card.avatarPath} />
  </div>
);

// Flat table / list view (like the reference CRM tables — demo-only, no DnD).
const TableView = ({ cards, columns }: { cards: Card[]; columns: Column[] }) => {
  const colName = (k: string) => columns.find((c) => c.key === k)?.title || k;
  const colTint = (k: string) => columns.find((c) => c.key === k)?.color || "#ccc";
  return (
    <div className="tbl-wrap">
      <div className="tbl">
        <div className="tbl-head">
          <span>Task</span>
          <span>Status</span>
          <span>Priority</span>
          <span>Assignee</span>
          <span>Due</span>
        </div>
        {cards.map((c) => (
          <div className="tbl-row" key={c.id} data-card-id={c.id}>
            <span className="tbl-task">
              <span className="tbl-dot" style={{ background: gradientFor(c.id) }} />
              {c.title}
            </span>
            <span>
              <span className="tbl-status" style={{ background: colTint(c.status) }}>
                {colName(c.status)}
              </span>
            </span>
            <span>
              {c.priority ? (
                <span className="tbl-pri">
                  <i style={{ background: priDot[c.priority] }} />
                  {c.priority}
                </span>
              ) : (
                <span className="tbl-muted">—</span>
              )}
            </span>
            <span className="tbl-who">
              <Avatar seed={c.assignee || c.id} path={c.avatarPath} />
              {nameFor(c.assignee)}
            </span>
            <span className="tbl-muted">{dueLabel(c.dueDate) || "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

type Evt = {
  id: number;
  kind: "move" | "change" | "delete";
  time: string;
  data: any;
};

const App = () => {
  const [view, setView] = useState<ViewKind>(initialView);
  const [deleteMode, setDeleteMode] = useState<DeleteConfirmation>(initialDelete);
  const [mode, setMode] = useState(initialMode);
  const [loadingSet, setLoadingSet] = useState<Set<string>>(
    new Set(initialLoading)
  );
  const [bulkCount, setBulkCount] = useState(initialBulk);
  const [virtualizeOver, setVirtualizeOver] = useState<number | undefined>(
    initialVirtualize
  );
  const [events, setEvents] = useState<Evt[]>([]);
  const [domCount, setDomCount] = useState(0);
  const [, setTick] = useState(0);
  const evtId = useRef(0);

  const seed = useMemo(
    () =>
      [
        ...baseCards,
        ...(view === "default" ? [] : showcaseExtras),
        ...makeBulk(bulkCount),
      ].filter((c) => !emptyCols.includes(c.status)),
    [bulkCount, view]
  );
  const [ctrlCards, setCtrlCards] = useState<Card[]>(seed);
  useEffect(() => setCtrlCards(seed), [seed]);

  const columns = useMemo(
    () => baseColumns.map((c) => ({ ...c, isLoading: loadingSet.has(c.key) })),
    [loadingSet]
  );

  const now = () =>
    new Date().toLocaleTimeString(undefined, {
      hour12: false,
      minute: "2-digit",
      second: "2-digit",
    });
  const push = (kind: Evt["kind"], data: any) =>
    setEvents((prev) =>
      [{ id: evtId.current++, kind, time: now(), data }, ...prev].slice(0, 14)
    );

  const handleCardMove = (
    cardId: string,
    newStatus: string,
    position: DropPosition
  ) => {
    const payload = { cardId, newStatus, ...position };
    // eslint-disable-next-line no-console
    console.log("onCardMove:", payload);
    push("move", payload);
  };
  const handleCardDelete = (cardId: string) => {
    // eslint-disable-next-line no-console
    console.log("onCardDelete:", cardId);
    push("delete", { cardId });
  };
  const handleCardsChange = (next: Card[]) => {
    // eslint-disable-next-line no-console
    console.log(
      "onCardsChange:",
      next.map((c) => `${c.id}:${c.status}`).join(",")
    );
    push("change", { count: next.length });
    if (mode === "controlled") setCtrlCards(next);
  };

  // Live "cards in DOM" measurement (shows the virtualization win).
  useEffect(() => {
    const measure = () =>
      setDomCount(
        document.querySelectorAll(".board-canvas [data-card-id]").length
      );
    measure();
    const id = window.setInterval(measure, 400);
    return () => window.clearInterval(id);
  }, []);

  const totalCards = mode === "controlled" ? ctrlCards.length : seed.length;

  const simulateFetch = () => {
    setLoadingSet(new Set(baseColumns.map((c) => c.key)));
    window.setTimeout(() => setLoadingSet(new Set(initialLoading)), 1500);
  };

  const commonProps = {
    columns,
    columnForAddCard: "todo",
    emptyColumnMessage: "No tasks yet",
    enableSearch: true,
    enableFiltering: true,
    filterConfigs,
    onCardMove: handleCardMove,
    onCardDelete: handleCardDelete,
    onCardsChange: handleCardsChange,
    deleteConfirmation: deleteMode,
    undoDuration: 3000,
    virtualizeColumnsOver: virtualizeOver,
    renderCard:
      view === "crm" ? crmCard : view === "compact" ? compactCard : undefined,
    renderColumnLoading: customLoadingParam
      ? (col: Column) => (
          <div data-testid={`custom-loading-${col.key}`}>
            Loading {col.title}…
          </div>
        )
      : undefined,
  };

  const isControlled = mode.startsWith("controlled");

  return (
    <div className="shell">
      <header className="masthead">
        <div>
          <span className="eyebrow">
            <span className="dot" /> React component · MIT
          </span>
          <h1 className="title">
            Kanban<em>Board</em>
          </h1>
          <p className="tagline">
            A Kanban board you can actually <b>drag with a finger</b>, operate
            with a <b>keyboard</b>, wire to a backend, and scale to thousands of
            cards. Everything below is live — poke at it.
          </p>
        </div>
        <div className="masthead-side">
          <div className="badge-row">
            <span className="badge solid">v3.0.0</span>
            <span className="badge">dnd-kit</span>
            <span className="badge">React 16–19</span>
          </div>
          <div className="caps">
            <span className="cap">
              <Ic d={icons.touch} />Touch
            </span>
            <span className="cap">
              <Ic d={icons.key} />Keyboard a11y
            </span>
            <span className="cap">
              <Ic d={icons.undo} />Undo
            </span>
            <span className="cap">
              <Ic d={icons.bolt} />Virtualized
            </span>
            <span className="cap">
              <Ic d={icons.lock} />WIP limits
            </span>
          </div>
        </div>
      </header>

      <section className="console">
        <div className="ctl">
          <span className="ctl-label">View</span>
          <div className="seg">
            {(
              [
                ["default", "Default"],
                ["crm", "CRM"],
                ["compact", "Compact"],
                ["table", "Table"],
              ] as [ViewKind, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                data-active={view === v}
                onClick={() => setView(v)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="ctl">
          <span className="ctl-label">State model</span>
          <div className="seg">
            <button
              data-active={!isControlled}
              onClick={() => setMode("uncontrolled")}
            >
              Uncontrolled
            </button>
            <button
              data-active={isControlled}
              onClick={() => setMode("controlled")}
            >
              Controlled
            </button>
          </div>
        </div>

        <div className="ctl">
          <span className="ctl-label">Delete behavior</span>
          <div className="seg">
            {(["immediate", "confirm", "undo"] as DeleteConfirmation[]).map(
              (m) => (
                <button
                  key={m}
                  data-active={deleteMode === m}
                  onClick={() => setDeleteMode(m)}
                >
                  {m[0].toUpperCase() + m.slice(1)}
                </button>
              )
            )}
          </div>
        </div>

        <div className="ctl">
          <span className="ctl-label">Scale &amp; performance</span>
          <div className="ctl-row">
            <button
              className="btn"
              onClick={() => setBulkCount((b) => b + 500)}
            >
              + 500 cards
            </button>
            <button
              className="btn toggle"
              data-on={virtualizeOver !== undefined}
              onClick={() =>
                setVirtualizeOver((v) => (v === undefined ? 40 : undefined))
              }
            >
              <Ic d={icons.bolt} /> Virtualize
            </button>
            {bulkCount > 0 && (
              <button
                className="btn ghost tiny"
                onClick={() => setBulkCount(initialBulk)}
              >
                reset
              </button>
            )}
          </div>
        </div>

        <div className="ctl">
          <span className="ctl-label">Columns</span>
          <div className="ctl-row">
            <button className="btn ghost" onClick={simulateFetch}>
              Simulate fetch
            </button>
            <button
              className="btn ghost tiny"
              data-testid="bump"
              onClick={() => setTick((t) => t + 1)}
            >
              force re-render
            </button>
          </div>
        </div>

        <div className="stat">
          <span className="stat-value">
            <b>{domCount}</b> / {totalCards}
          </span>
          <span className="stat-cap">cards in DOM · total</span>
        </div>
      </section>

      <div className="stage">
        <main className={`board-canvas ${view === "table" ? "is-table" : ""}`}>
          {view === "table" ? (
            <TableView
              cards={isControlled ? ctrlCards : seed}
              columns={columns}
            />
          ) : isControlled ? (
            <ControlledKanbanBoard
              key={`c-${bulkCount}-${view}`}
              {...commonProps}
              cards={ctrlCards}
              onCardsChange={handleCardsChange}
            />
          ) : (
            <KanbanBoard
              key={`u-${bulkCount}-${view}`}
              {...commonProps}
              initialCards={seed.slice()}
            />
          )}
        </main>

        <aside className="rail">
          <div className="rail-head">
            <span className="rail-title">
              <span className="pulse" /> Event stream
            </span>
            <span className="rail-count">{events.length ? `${events.length}` : "—"}</span>
          </div>
          <div className="rail-body">
            {events.length === 0 ? (
              <div className="rail-empty">
                Drag a card, reorder, or delete one.
                <br />
                Callbacks like <kbd>onCardMove</kbd> fire here in real time —
                with the exact <kbd>prevTaskId</kbd> / <kbd>nextTaskId</kbd>{" "}
                you'd persist to a backend.
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {events.map((e) => (
                  <motion.div
                    key={e.id}
                    layout
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="evt"
                  >
                    <div className="evt-top">
                      <span className={`evt-type ${e.kind}`}>
                        {e.kind === "move"
                          ? "onCardMove"
                          : e.kind === "change"
                          ? "onCardsChange"
                          : "onCardDelete"}
                      </span>
                      <span className="evt-time">{e.time}</span>
                    </div>
                    <div className="evt-body">
                      {e.kind === "move" && (
                        <>
                          <span className="v">{e.data.cardId}</span>
                          <span className="k"> → </span>
                          <span className="v">{e.data.newStatus}</span>
                          <br />
                          <span className="k">prev </span>
                          <span className="v">{String(e.data.prevTaskId)}</span>
                          <span className="k"> · next </span>
                          <span className="v">{String(e.data.nextTaskId)}</span>
                          <span className="k"> · idx </span>
                          <span className="n">{e.data.index}</span>
                        </>
                      )}
                      {e.kind === "change" && (
                        <>
                          <span className="k">next list · </span>
                          <span className="n">{e.data.count}</span>
                          <span className="k"> cards</span>
                        </>
                      )}
                      {e.kind === "delete" && (
                        <>
                          <span className="k">removed </span>
                          <span className="v">{e.data.cardId}</span>
                        </>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </aside>
      </div>

      <div className="hints">
        <span className="hint">
          <Ic d={icons.touch} style={{ width: 15, height: 15, color: "var(--accent)" }} />
          Drag with a mouse, long-press on touch
        </span>
        <span className="hint">
          <kbd>Space</kbd> pick up · <kbd>← ↑ ↓ →</kbd> move · <kbd>Space</kbd>{" "}
          drop · <kbd>Esc</kbd> cancel
        </span>
        <span className="hint">
          Search &amp; filter above the columns · WIP limit on “In Progress”
        </span>
      </div>
    </div>
  );
};

createRoot(document.getElementById("root")!).render(<App />);
