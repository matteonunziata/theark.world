// Roles, modules, and which roles see which module in the navigation.
// The database (RLS) is the real gate; this only shapes the UI.

export const ROLES = [
  { key: "admin", name: "Admin", desc: "Everything, including settings." },
  {
    key: "lead",
    name: "Division lead",
    desc: "Their division’s people, work, and reports.",
  },
  {
    key: "sales",
    name: "Sales",
    desc: "Contacts and the pipelines they’re assigned to.",
  },
  {
    key: "facilitator",
    name: "Facilitator",
    desc: "Their own classes and attendance.",
  },
  { key: "security", name: "Security", desc: "The security console only." },
  { key: "shop", name: "Shop staff", desc: "Farm shop sales and stock." },
  { key: "crew", name: "Maintenance crew", desc: "Their own work orders." },
] as const;

export type Role = (typeof ROLES)[number]["key"];

export const roleName = (k: string | null | undefined) =>
  ROLES.find((r) => r.key === k)?.name ?? "—";

export type ModuleKey =
  | "dashboard"
  | "crm"
  | "estate"
  | "hospitality"
  | "memberships"
  | "events"
  | "security"
  | "shop"
  | "school"
  | "operations"
  | "finance"
  | "settings";

export const MODULES: {
  key: ModuleKey;
  name: string;
  href: string;
  roles: Role[];
  planned?: string;
}[] = [
  {
    key: "dashboard",
    name: "Dashboard",
    href: "/dashboard",
    roles: ["admin", "lead", "sales", "facilitator", "shop"],
  },
  { key: "crm", name: "CRM", href: "/crm", roles: ["admin", "lead", "sales"] },
  {
    key: "estate",
    name: "Real estate",
    href: "/estate",
    roles: ["admin", "lead", "sales"],
  },
  {
    key: "hospitality",
    name: "Hospitality",
    href: "/hospitality",
    roles: ["admin", "lead", "sales"],
  },
  {
    key: "memberships",
    name: "Memberships",
    href: "/memberships",
    roles: ["admin", "lead", "sales"],
  },
  {
    key: "events",
    name: "Events & classes",
    href: "/events",
    roles: ["admin", "lead", "sales", "facilitator"],
  },
  {
    key: "security",
    name: "Security",
    href: "/security",
    roles: ["admin", "lead", "facilitator", "security"],
  },
  {
    key: "shop",
    name: "Farm shop",
    href: "/shop",
    roles: ["admin", "lead", "shop"],
  },
  {
    // Admins, plus anyone in a school division (added in the staff layout).
    key: "school",
    name: "Arkadia",
    href: "/arkadia",
    roles: ["admin"],
  },
  {
    key: "operations",
    name: "Operations",
    href: "/operations",
    roles: ["admin", "lead", "sales", "facilitator", "shop", "crew"],
  },
  { key: "finance", name: "Finance", href: "/finance", roles: ["admin"] },
  {
    key: "settings",
    name: "Settings",
    href: "/settings",
    roles: ["admin", "lead", "sales"],
  },
];

export const modulesFor = (role: string) =>
  MODULES.filter((m) => (m.roles as string[]).includes(role));

export const canSee = (role: string, key: ModuleKey) =>
  modulesFor(role).some((m) => m.key === key);

/** Where someone lands after signing in. */
export const homeFor = (role: string) => modulesFor(role)[0]?.href ?? "/";

export const TYPES = [
  ["team", "Team member"],
  ["facilitator", "Facilitator"],
  ["crew", "Maintenance crew"],
  ["contractor", "Contractor"],
] as const;

export const typeName = (k: string | null | undefined) =>
  TYPES.find((t) => t[0] === k)?.[1] ?? "Team member";

export const COLORS = ["leaf", "sea", "sun", "clay", "plum", "slate"] as const;

export const colorVar = (k: string | null | undefined) =>
  `var(--${COLORS.includes(k as (typeof COLORS)[number]) ? k : "slate"})`;
