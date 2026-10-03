import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useUi } from "@/stores/ui";
import { MembershipBanner } from "./membership-banner";
import { MoreMenu } from "./more-menu";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { UpdatePrompt } from "./update-prompt";

/**
 * Layout from docs/ecclesios-ui (D-010): dark sidebar + sticky topbar + content.
 * ≤980px the sidebar becomes a drawer opened by the hamburger; More is an off-canvas sheet.
 */
export function AppShell() {
  const { navOpen, setNavOpen, moreOpen, setMoreOpen } = useUi();
  const { pathname } = useLocation();

  useEffect(() => setNavOpen(false), [pathname, setNavOpen]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNavOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen, setNavOpen]);

  return (
    <div className={`shell${navOpen ? " nav-open" : ""}`}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="scrim" onClick={() => setNavOpen(false)} aria-hidden />

      <div className="main">
        <Topbar />
        <main id="main" className="content">
          <MembershipBanner />
          <Outlet />
        </main>
      </div>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent title="More" description="Church management, your account and Ecclesios.">
          <MoreMenu inSheet />
        </SheetContent>
      </Sheet>

      <UpdatePrompt />
    </div>
  );
}
