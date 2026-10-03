import { useRegisterSW } from "virtual:pwa-register/react";

/** PWA: ask before activating a new version, so nobody loses a half-read page. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;
  return (
    <div
      role="status"
      className="card fixed inset-x-4 bottom-6 z-[80] mx-auto flex max-w-md items-center gap-3 p-3"
    >
      <p className="flex-1 text-sm">A new version of Ecclesios is ready.</p>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNeedRefresh(false)}>
        Later
      </button>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={() => void updateServiceWorker(true)}
      >
        Update
      </button>
    </div>
  );
}
