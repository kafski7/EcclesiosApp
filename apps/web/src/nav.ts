import {
  Book,
  BookMarked,
  Compass,
  GraduationCap,
  Home,
  Menu,
  Mic,
  Music,
  User,
  type LucideIcon,
} from "lucide-react";

/** The fixed primary navigation of the social platform (blueprint §2.1), shown in the kit sidebar. */
export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const PRIMARY_NAV: NavItem[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/readings", label: "Readings", icon: Book },
  { to: "/saints", label: "Saints", icon: User },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/podcasts", label: "Podcasts", icon: Mic },
  { to: "/hymnal", label: "Hymnal", icon: Music },
  { to: "/teachings", label: "Teachings", icon: GraduationCap },
  { to: "/bible", label: "Bible", icon: BookMarked },
];

/** "More" opens the off-canvas menu (functionality §3.9); /more is its full-page fallback. */
export const MORE_ITEM: NavItem = { to: "/more", label: "More", icon: Menu };
