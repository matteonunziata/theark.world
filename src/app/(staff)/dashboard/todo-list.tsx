"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { dueClass, dueLabel, priName } from "@/lib/tasks";
import { addTodo, setTaskStatus } from "../operations/actions";

type Todo = {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  status: string;
  location: string | null;
};

/** The signed-in person's open tasks, as a checklist. */
export function TodoList({ todos, today }: { todos: Todo[]; today: string }) {
  const [list, toggle] = useOptimistic(todos, (cur, id: string) =>
    cur.map((t) => (t.id === id ? { ...t, status: t.status === "done" ? "next" : "done" } : t)),
  );
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();

  const check = (t: Todo) =>
    start(async () => {
      toggle(t.id);
      const r = await setTaskStatus(t.id, t.status === "done" ? "next" : "done");
      if (!r.ok) toast(r.error ?? "");
    });

  const add = () =>
    start(async () => {
      const r = await addTodo(draft);
      if (r.ok) setDraft("");
      else toast(r.error ?? "");
    });

  const open = list.filter((t) => t.status !== "done").length;

  return (
    <section className="todo">
      <header>
        <h2>Your to-dos</h2>
        <span className="muted">
          {open ? `${open} open` : "All clear"} · <Link href="/operations?asg=me">All your tasks</Link>
        </span>
      </header>
      <form
        className="todo-add"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) add();
        }}
      >
        <input
          aria-label="New to-do"
          placeholder="Add a to-do for yourself"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="btn" disabled={pending || !draft.trim()}>
          Add
        </button>
      </form>
      {!list.length ? (
        <p className="muted" style={{ margin: "6px 2px 0" }}>
          Nothing assigned to you. Tasks people give you in Operations show up here.
        </p>
      ) : (
        <ul>
          {list.map((t) => (
            <li key={t.id} className={t.status === "done" ? "done" : ""}>
              <label>
                <input type="checkbox" checked={t.status === "done"} onChange={() => check(t)} />
                <span className="t">{t.title}</span>
              </label>
              <span className="meta">
                {t.priority !== "medium" && t.status !== "done" && (
                  <span className={`pri ${t.priority}`}>
                    <i />
                    {priName(t.priority)}
                  </span>
                )}
                {t.due_date && t.status !== "done" && (
                  <span className={`due ${dueClass(t.due_date, t.status, today)}`}>
                    {dueLabel(t.due_date, today)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
