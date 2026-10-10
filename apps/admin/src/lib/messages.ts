import {
  MessageListSchema,
  MessagePreviewSchema,
  MessageRecipientListSchema,
  MessageSummarySchema,
  MessagingOptionsSchema,
  type ComposeMessage,
  type MessageChannel,
  type MessageStatus,
  type RecipientStatus,
} from "@ecclesios/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./query";

/** Messages & broadcasts (functionality §4.7, D-051). */
const base = (groupId: string) => `/cms/groups/${groupId}/messages`;

export const useMessagingOptions = (groupId: string) =>
  useQuery({
    queryKey: ["messages", groupId, "options"],
    queryFn: () => api.get(`${base(groupId)}/options`, MessagingOptionsSchema),
  });

export const useMessages = (groupId: string, page: number, channel: MessageChannel | null) =>
  useQuery({
    queryKey: ["messages", groupId, "list", page, channel],
    queryFn: () =>
      api.get(`${base(groupId)}?page=${page}${channel ? `&channel=${channel}` : ""}`, MessageListSchema),
    placeholderData: keepPreviousData,
    // Sending happens on the workers: refresh while anything is still going out.
    refetchInterval: (q) =>
      q.state.data?.items.some((m) => m.status === "QUEUED" || m.status === "SENDING") ? 4000 : false,
  });

export const useMessage = (groupId: string, id: string | undefined) =>
  useQuery({
    queryKey: ["messages", groupId, "one", id],
    queryFn: () => api.get(`${base(groupId)}/${id}`, MessageSummarySchema),
    enabled: !!id,
    refetchInterval: (q) =>
      q.state.data && (q.state.data.status === "QUEUED" || q.state.data.status === "SENDING") ? 3000 : false,
  });

export const useRecipients = (
  groupId: string,
  id: string,
  page: number,
  status: RecipientStatus | null,
  live: boolean,
) =>
  useQuery({
    queryKey: ["messages", groupId, "recipients", id, page, status],
    queryFn: () =>
      api.get(
        `${base(groupId)}/${id}/recipients?page=${page}${status ? `&status=${status}` : ""}`,
        MessageRecipientListSchema,
      ),
    placeholderData: keepPreviousData,
    refetchInterval: live ? 3000 : false,
  });

/** Estimate (debounced by the caller). */
export const usePreview = (groupId: string, body: ComposeMessage | null) =>
  useQuery({
    queryKey: ["messages", groupId, "preview", body],
    queryFn: () => api.post(`${base(groupId)}/preview`, body, MessagePreviewSchema),
    enabled: !!body,
    placeholderData: keepPreviousData,
    retry: false,
  });

export function useSendMessage(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: ComposeMessage) => api.post(base(groupId), b, MessageSummarySchema),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["messages", groupId] });
      void qc.invalidateQueries({ queryKey: ["cms", "contexts"] }); // SMS balance in the banner
    },
  });
}

export const CHANNEL_TEXT: Record<MessageChannel, string> = {
  SMS: "SMS",
  EMAIL: "Email",
  IN_APP: "In-app",
};

export const STATUS_TEXT: Record<MessageStatus, { label: string; color: string }> = {
  QUEUED: { label: "Queued", color: "secondary" },
  SENDING: { label: "Sending", color: "info" },
  SENT: { label: "Sent", color: "success" },
  PARTIAL: { label: "Partly sent", color: "warning" },
  FAILED: { label: "Failed", color: "danger" },
};

export const RECIPIENT_TEXT: Record<RecipientStatus, { label: string; color: string }> = {
  PENDING: { label: "Waiting", color: "secondary" },
  SENT: { label: "Sent", color: "success" },
  FAILED: { label: "Failed", color: "danger" },
  SKIPPED: { label: "Skipped", color: "light" },
};

export const FAILURE_TEXT: Record<string, string> = {
  INSUFFICIENT_SMS_BALANCE: "Not enough SMS credit when sending started.",
  SMS_NOT_AVAILABLE: "SMS wasn't available for this church.",
};

export const LEVEL_PLURAL: Record<string, string> = {
  ARCHDIOCESE: "Archdioceses",
  DIOCESE: "Dioceses",
  DEANERY: "Deaneries",
  PARISH: "Parishes",
  OUTSTATION: "Outstations",
};
