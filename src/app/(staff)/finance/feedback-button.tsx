"use client";

import { usePathname } from "next/navigation";
import { Drawer, useDrawer } from "@/components/drawer";
import { sendFeedback } from "./budgets/actions";

export function FeedbackButton() {
  const d = useDrawer<true>();
  const page = usePathname();
  return (
    <>
      <button type="button" className="btn" onClick={() => d.openItem(true)}>
        Leave feedback
      </button>
      <Drawer
        title="Leave feedback"
        open={d.open}
        onClose={d.close}
        action={sendFeedback}
        footer={
          <>
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={d.close}>Cancel</button>
            <button type="submit" className="btn primary">Send</button>
          </>
        }
      >
        <input type="hidden" name="page" value={page} />
        <div className="fld">
          <label htmlFor="fb-body">What’s working, what’s confusing, what’s missing?</label>
          <textarea id="fb-body" name="body" rows={6} required autoFocus />
          <span className="hint">We note who you are, your sector and this page ({page}).</span>
        </div>
      </Drawer>
    </>
  );
}
