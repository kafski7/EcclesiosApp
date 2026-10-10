import {
  Bookmark,
  Building2,
  FileText,
  Info,
  Library,
  LogIn,
  Megaphone,
  UserPlus,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SheetClose } from "@/components/ui/sheet";
import { useSignInHere } from "@/components/auth/sign-in-link";
import { useSession } from "@/stores/session";

/**
 * More menu (functionality §3.9, docs/social.md §4.3), styled with kit classes.
 * Rendered in the off-canvas sheet and on /more. Account, notifications and the Church
 * Management link live in the top bar's account menu (S-004/S-005, D-042); the "You" section
 * keeps Saved and My library as shortcuts, or the sign-in doors for visitors.
 */
export function MoreMenu({ inSheet = false }: { inSheet?: boolean }) {
  const principal = useSession((s) => s.principal);
  const signIn = useSignInHere();
  const register = useSignInHere("/register");

  const Item = ({
    to,
    icon,
    label,
    hint,
    external = false,
  }: {
    to: string;
    icon: ReactNode;
    label: string;
    hint?: string;
    /** Another site (the CMS, D-028): a plain link, not a router link. */
    external?: boolean;
  }) => {
    const cls =
      "flex items-center gap-3 rounded-[10px] px-3 py-2.5 transition-colors hover:bg-[var(--primary-soft)]";
    const Tag = external
      ? (p: { children: ReactNode }) => (
          <a href={to} className={cls}>
            {p.children}
          </a>
        )
      : (p: { children: ReactNode }) => (
          <Link to={to} className={cls}>
            {p.children}
          </Link>
        );
    const link = (
      <Tag>
        <span className="text-[var(--accent-600)] [&_svg]:size-[18px]">{icon}</span>
        <span className="flex flex-col">
          <span className="text-[14px] font-semibold text-[var(--text)]">{label}</span>
          {hint ? <span className="small muted">{hint}</span> : null}
        </span>
      </Tag>
    );
    return <li>{inSheet ? <SheetClose asChild>{link}</SheetClose> : link}</li>;
  };

  return (
    <nav aria-label="More" className="flex flex-col gap-5">
      <Section title="Church Management">
        <Item
          to="/subscribe"
          icon={<Building2 />}
          label="Subscribe your church"
          hint="Basic, Premium or Ultimate"
        />
      </Section>
      {principal?.kind === "member" ? (
        <Section title="You">
          <Item to="/saved" icon={<Bookmark />} label="Saved" />
          <Item to="/library" icon={<Library />} label="My library" />
        </Section>
      ) : principal ? null : (
        <Section title="You">
          <Item to={signIn} icon={<LogIn />} label="Sign in" />
          <Item to={register} icon={<UserPlus />} label="Create an account" />
        </Section>
      )}
      <Section title="Ecclesios">
        <Item to="/news" icon={<Megaphone />} label="Ecclesios news" />
        <Item to="/about" icon={<Info />} label="About" />
        <Item to="/privacy" icon={<FileText />} label="Privacy" />
        <Item to="/terms" icon={<FileText />} label="Terms" />
      </Section>
    </nav>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="saint-kicker px-3 pb-1 font-sans">{title}</h2>
      <ul className="flex flex-col">{children}</ul>
    </section>
  );
}
