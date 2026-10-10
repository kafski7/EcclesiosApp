import { useEffect, type RefObject } from "react";
import { nextTop } from "@/lib/sticky-rail";

/** Desktop only — below this the rail is hidden (kit) and Home shows the Today strip instead. */
const DESKTOP = "(min-width: 1151px)";
const GAP = 16;

/**
 * Wires lib/sticky-rail to the Home rail (D-046): one rAF-throttled scroll listener sets the
 * rail's sticky `top`; a ResizeObserver re-clamps when cards load or the window changes size.
 * Leaves the mini-player's height clear at the bottom so it never covers the last card.
 */
export function useStickyRail(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined") return;
    const mq = window.matchMedia(DESKTOP);
    const height = (sel: string) => document.querySelector<HTMLElement>(sel)?.offsetHeight ?? 0;
    const box = () => ({
      header: (height(".topbar") || 68) + GAP,
      bottomGap: GAP + height(".mini-player"),
      viewport: window.innerHeight,
      railHeight: el.offsetHeight,
    });

    let top = box().header;
    let lastY = window.scrollY;
    let frame = 0;
    const apply = (delta: number) => {
      if (!mq.matches) {
        el.style.top = "";
        return;
      }
      top = nextTop(top, delta, box());
      el.style.top = `${top}px`;
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        apply(y - lastY);
        lastY = y;
      });
    };
    const reclamp = () => apply(0);
    const onMedia = () => {
      top = box().header;
      lastY = window.scrollY;
      apply(0);
    };

    apply(0);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", reclamp);
    mq.addEventListener("change", onMedia);
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(reclamp);
    ro?.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", reclamp);
      mq.removeEventListener("change", onMedia);
      ro?.disconnect();
      el.style.top = "";
    };
  }, [ref]);
}
