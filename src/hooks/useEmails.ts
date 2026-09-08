import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useEmailStore } from "@/store/emailStore";
import type { Email, EmailListOut, EmailUpdateRequest } from "@/types";
import { showError, showSuccess } from "@/lib/notifications";

type EntityId = string | number;

export function useEmails() {
  const filters = useEmailStore((s) => s.filters);

  return useQuery<EmailListOut>({
    queryKey: ["emails", filters],
    queryFn: async () => {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== undefined && v !== "")
      );
      const { data } = await api.get("/api/emails", { params });
      return data;
    },
  });
}

export function useEmail(id: EntityId) {
  return useQuery<Email>({
    queryKey: ["email", id],
    queryFn: async () => {
      const { data } = await api.get(`/api/emails/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useAnalyzeEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: EntityId) => api.post(`/api/emails/${id}/analyze`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["email", id] });
      qc.invalidateQueries({ queryKey: ["emails"] });
      showSuccess("Email analysis completed.");
    },
    onError: (error) => showError(error, "Email analysis failed."),
  });
}

export function useUpdateEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: EntityId; body: EmailUpdateRequest }) =>
      api.patch(`/api/emails/${id}`, body),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["email", id] });
      qc.invalidateQueries({ queryKey: ["emails"] });
      showSuccess("Email updated.");
    },
    onError: (error) => showError(error, "Could not update the email."),
  });
}
