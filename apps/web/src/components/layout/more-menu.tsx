import { Bell, Building2, FileText, Info, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SheetClose } from "@/components/ui/sheet";
import { useSession } from "@/stores/session";

/**
 * More menu (functionality §3.9), styled with kit classes (.qa-btn-like rows, kit kicker headings).
 * Rendered in the off-canvas sheet and on /more.
 */
export function MoreMenu({ inSheet = false }: { inSheet?: boolean }) {
  const principal = useSession((s) => s.principal);

  const Item = ({ to, icon, label, hint }: { to: string; icon: ReactNode; label: string; hint?: string }) => {
    const link = (
      <Link
        to={to}
        className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 transition-colors hover:bg-[var(--primary-soft)]"
      >
        <span className="text-[var(--accent-600)] [&_svg]:size-[18px]">{icon}</span>
        <span className="flex flex-col">
          <span className="text-[14px] font-semibold text-[var(--text)]">{label}</span>
          {hint ? <span className="small muted">{hint}</span> : null}
        </span>
      </Link>
    );
    return <li>{inSheet ? <SheetClose asChild>{link}</SheetClose> : link}</li>;
  };

  return (
    <nav aria-label="More" className="flex flex-col gap-5">
      <Section title="Church Management">
        <Item to="/subscribe" icon={<Building2 />} label="Subscribe your church" hint="Basic, Premium or Ultimate" />
        <Item to="/cms-login" icon={<ShieldCheck />} label="Church Management login" hint="For subscribed churches" />
      </Section>
      <Section title="You">
        <Item to="/notifications" icon={<Bell />} label="Notifications" />
        {principal ? null : (
          <>
            <Item to="/login" icon={<LogIn />} label="Sign in" />
            <Item to="/register" icon={<UserPlus />} label="Create an account" />
          </>
        )}
      </Section>
      <Section title="Ecclesios">
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
