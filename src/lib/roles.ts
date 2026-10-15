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
  {
    key: "marketing",
    name: "Marketing",
    desc: "Brand strategy, content, social, email and marketing analytics.",
  },
  {
    key: "community_manager",
    name: "Community manager",
    desc: "Members, events and day-to-day community work.",
  },
] as const;

export type Role = (typeof ROLES)[number]["key"];

export const roleName = (k: string | null | undefined) =>
  ROLES.find((r) => r.key === k)?.name ?? "—";

export type ModuleKey =
  | "classes"
  | "dashboard"
  | "crm"
  | "estate"
  | "hospitality"
  | "memberships"
  | "events"
  | "security"
  | "shop"
  | "school"
  | "marketing"
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
    // A facilitator's own classes and who's booked. First, so it's their home.
    key: "classes",
    name: "My classes",
    href: "/classes",
    roles: ["facilitator"],
  },
  {
    key: "dashboard",
    name: "Dashboard",
    href: "/dashboard",
    roles: ["admin", "lead", "sales", "shop", "crew", "community_manager"],
  },
  {
    key: "crm",
    name: "CRM",
    href: "/crm",
    roles: ["admin", "lead", "sales", "community_manager"],
  },
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
    roles: ["admin", "lead", "sales", "community_manager"],
  },
  {
    key: "events",
    name: "Schedule",
    href: "/admin-schedule",
    roles: ["admin", "lead", "sales", "community_manager"],
  },
  {
    key: "security",
    name: "Security",
    href: "/security",
    roles: ["admin", "lead", "security"],
  },
  {
    key: "shop",
    name: "Farm shop",
    href: "/shop",
    roles: ["admin", "lead", "shop", "community_manager"],
  },
  {
    // Admins, plus anyone in a school division (added in the staff layout).
    key: "school",
    name: "Arkadia",
    href: "/arkadia",
    roles: ["admin"],
  },
  {
    key: "marketing",
    name: "Marketing",
    href: "/marketing",
    roles: ["admin", "marketing"],
  },
  {
    key: "operations",
    name: "Operations",
    href: "/operations",
    roles: ["admin", "lead", "sales", "shop", "crew", "marketing", "community_manager"],
  },
  { key: "finance", name: "Finance", href: "/finance", roles: ["admin"] },
  {
    key: "settings",
    name: "Settings",
    href: "/settings",
    roles: ["admin", "lead", "sales"],
  },
];

/** Page access saved in Settings → Access levels, by role. Admins are never limited. */
export type RoleAccess = Partial<Record<string, string[]>>;

export const modulesFor = (role: string, access?: RoleAccess) => {
  const saved = role === "admin" ? undefined : access?.[role];
  return MODULES.filter((m) =>
    saved ? saved.includes(m.key) : (m.roles as string[]).includes(role),
  );
};

export const canSee = (role: string, key: ModuleKey, access?: RoleAccess) =>
  modulesFor(role, access).some((m) => m.key === key);

/** Where someone lands after signing in. */
export const homeFor = (role: string, access?: RoleAccess) =>
  modulesFor(role, access)[0]?.href ?? "/no-access";

export const TYPES = [
  ["team", "Team member"],
  ["facilitator", "Facilitator"],
  ["crew", "Maintenance crew"],
  ["contractor", "Contractor"],
  ["security", "Security"],
] as const;

export const typeName = (k: string | null | undefined) =>
  TYPES.find((t) => t[0] === k)?.[1] ?? "Team member";

export const COLORS = ["leaf", "sea", "sun", "clay", "plum", "slate"] as const;

export const colorVar = (k: string | null | undefined) =>
  `var(--${COLORS.includes(k as (typeof COLORS)[number]) ? k : "slate"})`;
