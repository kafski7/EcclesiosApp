import type { HierarchyLevel, MemberRole } from "@ecclesios/shared/domain";
import {
  Bell,
  BookUser,
  Cake,
  CreditCard,
  FileStack,
  GraduationCap,
  HandCoins,
  Network,
  LayoutDashboard,
  Library,
  Megaphone,
  Compass,
  Mic,
  Music,
  ListChecks,
  Mail,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface CmsNavItem extends NavItem {
  roles: readonly MemberRole[];
  /** Extra condition on the church's level. */
  levels?: readonly HierarchyLevel[];
}

const STAFF: readonly MemberRole[] = ["ADMINISTRATOR", "MANAGER"];
const ALL: readonly MemberRole[] = ["ADMINISTRATOR", "MANAGER", "SOCIETY_LEADER"];

/**
 * CMS sidebar (blueprint §2.2, §3.3), in the order of docs/ecclesios-ui/admin.html.
 * Roles follow the seeded role permissions: Managers have no Users/Settings/Billing;
 * Society-Leaders see rosters only. Billing lives with the parish that holds the subscription.
 */
const CMS_NAV: readonly CmsNavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, roles: ALL },
  // The groups under this one (D-041) — every level except outstations, which have none.
  {
    to: "/admin/groups",
    label: "Groups",
    icon: Network,
    roles: STAFF,
    levels: ["PROVINCE", "ARCHDIOCESE", "DIOCESE", "DEANERY", "PARISH"],
  },
  // Register and birthdays read records: staff only (D-037). Leaders keep their rosters in Societies (D-038).
  { to: "/admin/members", label: "Members", icon: BookUser, roles: STAFF },
  { to: "/admin/birthdays", label: "Birthdays", icon: Cake, roles: STAFF },
  { to: "/admin/societies", label: "Societies", icon: UsersRound, roles: ALL },
  { to: "/admin/committees", label: "Committees", icon: ListChecks, roles: ALL },
  // Outstations record, parishes review (blueprint §8.1, D-041).
  {
    to: "/admin/collections",
    label: "Collections",
    icon: HandCoins,
    roles: STAFF,
    levels: ["PARISH", "OUTSTATION"],
  },
  { to: "/admin/notifications", label: "Notifications", icon: Bell, roles: ALL },
  { to: "/admin/messages", label: "Messages", icon: Mail, roles: STAFF },
  { to: "/admin/users", label: "Users & Roles", icon: UserCog, roles: ["ADMINISTRATOR"] },
];

const CMS_FOOTER_NAV: readonly CmsNavItem[] = [
  { to: "/admin/settings", label: "Settings", icon: Settings, roles: ["ADMINISTRATOR"] },
  {
    to: "/admin/billing",
    label: "Billing",
    icon: CreditCard,
    roles: ["ADMINISTRATOR"],
    levels: ["PARISH"],
  },
];

const allowed = (role: MemberRole, level: HierarchyLevel) => (i: CmsNavItem) =>
  i.roles.includes(role) && (!i.levels || i.levels.includes(level));

/** Sidebar items for a role in a church of a given level. */
export function cmsNav(role: MemberRole, level: HierarchyLevel) {
  return {
    main: CMS_NAV.filter(allowed(role, level)),
    footer: CMS_FOOTER_NAV.filter(allowed(role, level)),
  };
}

/** Platform console (Super-Admin). Moderation, creators and reference data arrive in Phase 8. */
export const PLATFORM_NAV: readonly NavItem[] = [
  { to: "/platform", label: "Overview", icon: LayoutDashboard },
  { to: "/platform/subscriptions", label: "Subscriptions", icon: CreditCard },
  { to: "/platform/hymnal", label: "Hymnal", icon: Music },
  { to: "/platform/podcasts", label: "Podcasts", icon: Mic },
  { to: "/platform/teachings", label: "Teachings", icon: GraduationCap },
  { to: "/platform/news", label: "News", icon: Megaphone },
  { to: "/platform/books", label: "Books", icon: Library },
  { to: "/platform/explore", label: "Explore moderation", icon: ShieldCheck },
  { to: "/platform/creators", label: "Creators", icon: Users },
  { to: "/platform/reference", label: "Reference data", icon: FileStack },
];

/** Creator accounts (D-027, D-031, D-036): their own podcasts, Explore posts and books. */
export const CREATOR_NAV: readonly NavItem[] = [
  { to: "/platform/podcasts", label: "Podcasts", icon: Mic },
  { to: "/platform/explore/mine", label: "Explore posts", icon: Compass },
  { to: "/platform/books/mine", label: "My books", icon: Library },
];
