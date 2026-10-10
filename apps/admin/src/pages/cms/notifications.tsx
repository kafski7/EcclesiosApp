import { useCurrent } from "@/lib/cms";
import { NotificationsPage } from "@/pages/notifications";

export function CmsNotificationsPage() {
  const ctx = useCurrent();
  return <NotificationsPage church={{ id: ctx.group.id, name: ctx.group.name }} />;
}
