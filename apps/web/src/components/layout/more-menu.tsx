import { Bell, Bookmark, Building2, FileText, Info, LogIn, Megaphone, ShieldCheck, UserPlus } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SheetClose } from "@/components/ui/sheet";
import { env } from "@/lib/env";
import { useSession } from "@/stores/session";

/**
 * More menu (functionality §3.9), styled with kit classes (.qa-btn-like rows, kit kicker headings).
 * Rendered in the off-canvas sheet and on /more.
 */
export function MoreMenu({ inSheet = false }: { inSheet?: boolean }) {
  const principal = useSession((s) => s.principal);

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
      ? (p: { children: ReactNode }) => <a href={to} className={cls}>{p.children}</a>
      : (p: { children: ReactNode }) => <Link to={to} className={cls}>{p.children}</Link>;
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
        <Item
          to={`${env.VITE_ADMIN_URL}/login`}
          external
          icon={<ShieldCheck />}
          label="Church Management login"
          hint="For subscribed churches"
        />
      </Section>
      <Section title="You">
        <Item to="/notifications" icon={<Bell />} label="Notifications" />
        {principal?.kind === "member" ? <Item to="/saved" icon={<Bookmark />} label="Saved" /> : null}
        {principal ? null : (
          <>
            <Item to="/login" icon={<LogIn />} label="Sign in" />
            <Item to="/register" icon={<UserPlus />} label="Create an account" />
          </>
        )}
      </Section>
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
