import { HealthResponseSchema } from "@ecclesios/shared";
import { useQuery } from "@tanstack/react-query";
import { MoreMenu } from "@/components/layout/more-menu";
import { api } from "@/lib/query";

/** Full-page More menu (functionality §3.9) + API status line. */
export function MorePage() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => api.get("/health", HealthResponseSchema),
    staleTime: 30_000,
  });
  const ok = health.data?.status === "ok";
  const status = health.isPending ? "Checking connection…" : ok ? "Connected" : "Offline — some features are unavailable";

  return (
    <div className="mx-auto max-w-md">
      <div className="page-head">
        <h1 className="page-title">More</h1>
      </div>
      <div className="card rail-card">
        <MoreMenu />
      </div>
      <p className="small muted mt-6 flex items-center gap-2 px-3" role="status">
        <span className={`chip-dot ${ok ? "text-[var(--success)]" : "text-[var(--text-3)]"}`} />
        {status}
      </p>
    </div>
  );
}
