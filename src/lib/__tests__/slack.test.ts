import { describe, expect, it } from "vitest";
import {
  applicationMessage,
  bookingMessage,
  channelFor,
  describeSlackError,
  digestMessage,
  esc,
  fmtMoney,
  KINDS,
  message,
  normalizeChannel,
  parseRules,
  paymentMessage,
  rulesFromForm,
  taskMessage,
} from "../slack-format";

describe("channels", () => {
  it("adds the # and keeps ids", () => {
    expect(normalizeChannel("general")).toBe("#general");
    expect(normalizeChannel(" #front-desk ")).toBe("#front-desk");
    expect(normalizeChannel("C0123ABCDEF")).toBe("C0123ABCDEF");
    expect(normalizeChannel("")).toBe("");
  });

  it("falls back to the default channel and respects off switches", () => {
    const i = { enabled: true, channel: "#ark-os", rules: parseRules({ booking: { on: true }, payment: { on: true, channel: "finance" } }) };
    expect(channelFor(i, "booking")).toBe("#ark-os");
    expect(channelFor(i, "payment")).toBe("#finance");
    expect(channelFor(i, "task")).toBeNull();
    expect(channelFor({ ...i, enabled: false }, "booking")).toBeNull();
    expect(channelFor({ ...i, channel: null }, "booking")).toBeNull();
  });
});

describe("rules", () => {
  it("drops unknown kinds and odd shapes", () => {
    expect(parseRules(null)).toEqual({});
    expect(parseRules([1, 2])).toEqual({});
    expect(parseRules({ booking: { on: "yes" }, nonsense: { on: true }, lead: { on: true, channel: "  " } })).toEqual({
      booking: { on: false, channel: null },
      lead: { on: true, channel: null },
    });
  });

  it("reads one checkbox and one channel per kind from the form", () => {
    const values: Record<string, string> = { channel_payment: "finance" };
    const checked = new Set(["on_payment", "on_digest"]);
    const r = rulesFromForm(
      (n) => values[n] ?? null,
      (n) => checked.has(n),
    );
    expect(Object.keys(r)).toHaveLength(KINDS.length);
    expect(r.payment).toEqual({ on: true, channel: "#finance" });
    expect(r.digest).toEqual({ on: true, channel: null });
    expect(r.booking).toEqual({ on: false, channel: null });
  });
});

describe("errors", () => {
  it("explains the common Slack codes", () => {
    expect(describeSlackError("not_in_channel", "#private")).toContain("/invite");
    expect(describeSlackError("channel_not_found", "#nope")).toContain("#nope");
    expect(describeSlackError("invalid_auth")).toContain("token");
    expect(describeSlackError("weird_code")).toBe("Slack said: weird_code.");
  });
});

describe("messages", () => {
  it("escapes what people typed", () => {
    expect(esc("<b>Tom & Jerry</b>")).toBe("&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;");
    const m = applicationMessage({ name: "A <script>", email: "a@x.com", plan: "month", why: "I <3 it" }, "https://os.test");
    expect(m.text).toContain("A &lt;script&gt;");
    expect(m.text).toContain("> I &lt;3 it");
    expect(m.text).toContain("<https://os.test/memberships|Memberships>");
  });

  it("builds a fallback text and blocks together", () => {
    const m = message("*Hi*", ["one", null, "", "two"], "footer");
    expect(m.text).toBe("*Hi*\none\ntwo\nfooter");
    expect(m.blocks).toHaveLength(2);
  });

  it("links the event page for a booking", () => {
    const m = bookingMessage(
      { holder: "Ana", title: "Sunrise Yoga", date: "2026-10-07", startTime: "07:00", offeringId: "o1", price: "₡5,000" },
      "https://os.test",
    );
    expect(m.text).toContain("Ana → Sunrise Yoga");
    expect(m.text).toContain("7am");
    expect(m.text).toContain("<https://os.test/e/o1/2026-10-07|Event page>");
  });

  it("marks test-mode payments and formats money", () => {
    expect(fmtMoney(130000, "CRC")).toBe("₡130,000");
    expect(fmtMoney(45.5, "USD")).toBe("$45.5");
    const m = paymentMessage({ kind: "membership", amount: "₡130,000", name: "Ana", email: "a@x.com", live: false, contactId: "c1" }, "https://os.test");
    expect(m.text).toContain("test mode");
    expect(m.text).toContain("/crm/contact/c1");
  });

  it("keeps a task message short and mentions who", () => {
    const m = taskMessage({ title: "Fix the gate", assignee: "Luis", by: "Matteo", dueDate: "2026-10-08", priority: "high" }, "https://os.test");
    expect(m.text).toContain("*Task for Luis:* Fix the gate");
    expect(m.text).toContain("High priority");
    expect(m.text).toContain("from Matteo");
  });
});

describe("digest", () => {
  const base = {
    date: "2026-10-06",
    orgName: "The ARK",
    sessions: [],
    guests: [],
    tasks: [],
    yesterday: { bookings: 0, payments: { count: 0, totals: [] } },
    waiting: { applications: 0, stays: 0 },
  };

  it("says when there's nothing", () => {
    const m = digestMessage(base, "https://os.test");
    expect(m.text).toContain("No classes or events today.");
    expect(m.text).toContain("No guest passes for today.");
    expect(m.text).toContain("Nothing due today.");
    expect(m.text).not.toContain("Waiting on us");
  });

  it("lists the day and what's waiting", () => {
    const m = digestMessage(
      {
        ...base,
        sessions: [
          { title: "Yoga", startTime: "07:00", booked: 4, capacity: 12, cancelled: false },
          { title: "Cancelled thing", startTime: "09:00", booked: 0, capacity: null, cancelled: true },
        ],
        guests: [{ guest: "Sam", host: "Ana" }],
        tasks: [{ title: "Order compost", assignee: "Luis", overdue: true }],
        yesterday: { bookings: 3, payments: { count: 2, totals: ["₡130,000", "$45"] } },
        waiting: { applications: 1, stays: 2 },
      },
      "https://os.test",
    );
    expect(m.text).toContain("7am  Yoga · 4/12");
    expect(m.text).not.toContain("Cancelled thing");
    expect(m.text).toContain("Sam _(with Ana)_");
    expect(m.text).toContain("⚠︎ Order compost · Luis");
    expect(m.text).toContain("3 bookings");
    expect(m.text).toContain("2 payments: ₡130,000 + $45");
    expect(m.text).toContain("1 membership application to review");
    expect(m.text).toContain("2 requests to stay to confirm");
  });
});
