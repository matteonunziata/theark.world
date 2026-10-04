"use client";

import { useTransition } from "react";
import { useToast } from "@/components/toast";
import { loadSampleData, removeSampleData } from "../sample-actions";

export function SampleCard({ loaded }: { loaded: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const run = (fn: typeof loadSampleData) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? (r.message ?? "") : (r.error ?? ""));
    });
  return (
    <div className="form-card" style={{ marginTop: 16 }}>
      <h2>Sample data</h2>
      <p className="muted" style={{ margin: "4px 0 14px" }}>
        {loaded
          ? "Sample people, classes, tasks, products, and figures are loaded. Remove them before you go live; your own records stay."
          : "Fill ARK OS with a realistic week at The ARK to show people around. Everything it adds is marked and can be removed in one step."}
      </p>
      <button
        type="button"
        className={`btn ${loaded ? "danger" : "primary"}`}
        disabled={pending}
        onClick={() => run(loaded ? removeSampleData : loadSampleData)}
      >
        {pending ? "Working…" : loaded ? "Remove sample data" : "Load sample data"}
      </button>
    </div>
  );
}
