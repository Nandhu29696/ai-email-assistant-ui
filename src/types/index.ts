// ─── Shared types for the email intake app ────────────────────────────────────

export type Provider = "gmail" | "outlook" | "imap";
export type Priority = "critical" | "high" | "medium" | "low";
export type UserRole = "admin" | "client";

/** RECEIVED → PROCESSING → SUCCESS | REJECTED | FAILED (IGNORED = automated mail). */
export type BatchStatus = "RECEIVED" | "PROCESSING" | "REPROCESSING" | "SUCCESS" | "REJECTED" | "FAILED" | "IGNORED";

/** Which rule decided the result. */
export type Outcome =
  | "PROCESSED" | "DOMAIN_NOT_ALLOWED" | "NO_ATTACHMENT" | "INVALID_FILE_TYPE"
  | "INVALID_ATTACHMENTS" | "SENDER_NOT_VERIFIED" | "AUTOMATED_MESSAGE" | "SYSTEM_ERROR";

export interface Integration {
  id: number;
  provider: Provider;
  email_address: string;
  is_active: boolean;
  owner_user_id?: number | null;
  batch_prefix?: string | null;
  mailbox_type?: string | null;
  allowed_extensions?: string | null;
  max_file_size_mb?: number | null;
  allowed_sender_domains?: string | null;
  retention_days?: number | null;
  process_since?: string | null;
  last_sync_at?: string | null;
  last_email_processed_at?: string | null;
  health_status: string;
  health_message?: string | null;
  imap_host?: string | null;
  smtp_host?: string | null;
  created_at: string;
}

export interface BatchItem {
  id: number;
  batch_no: string;
  sender_name: string | null;
  sender_email: string;
  recipient_email: string | null;
  subject: string | null;
  status: BatchStatus;
  outcome: Outcome | null;
  status_reason: string | null;
  mailbox_type: string | null;
  attachment_count: number;
  sentiment: string | null;
  sentiment_score: number | null;
  primary_emotion: string | null;
  email_category: string | null;
  priority: Priority | null;
  ai_summary: string | null;
  has_merged_pdf: boolean;
  is_archived: boolean;
  archived_at: string | null;
  received_datetime: string | null;
  processed_at: string | null;
}

export interface BatchList {
  total: number;
  page: number;
  page_size: number;
  items: BatchItem[];
}

export interface BatchEvent {
  event_type: string;
  related_filename: string | null;
  reply_sent: boolean;
  details: Record<string, unknown>;
  created_at: string | null;
}

export interface BatchAttachment {
  id: number;
  filename: string;
  doc_type: string | null;
  file_size_bytes: number | null;
  is_encrypted: boolean;
  status: string;
  status_reason: string | null;
  has_pdf: boolean;
}

export interface BatchDetail extends BatchItem {
  message_id: string;
  body_text: string | null;
  ai_model_version: string | null;
  has_email_pdf: boolean;
  events: BatchEvent[];
  attachments: BatchAttachment[];
}

export interface DashboardSummary {
  days: number;
  total: number;
  by_status: Record<string, number>;
  by_outcome: Record<Outcome, number>;
  by_category: Record<string, number>;
  by_sentiment: Record<string, number>;
  by_priority: Record<string, number>;
  daily: Array<{ date: string; SUCCESS: number; REJECTED: number; FAILED: number; OTHER: number }>;
  pickup: {
    automatic: boolean;
    interval_seconds: number;
    mailboxes: Array<{
      id: number; email_address: string; provider: Provider;
      health_status: string; health_message: string | null;
      last_sync_at: string | null; last_email_processed_at: string | null;
    }>;
  };
  allowed_domains_configured: number;
  ops_alerts_configured: boolean;
  retention_days_default: number;
}

export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  database: boolean;
  redis: boolean | null;
  llm: { ok: boolean | null; detail: string | null };
  converter: { ok: boolean; detail: string };
  mail_pickup: "api" | "worker";
  ops_alerts: boolean;
}

export interface ReplyTemplate {
  template_key: string;
  label: string;
  placeholders: string[];
  subject_template: string;
  html_body_template: string;
  signature_html: string;
  is_default: boolean;
  integration_id: number | null;
  is_override: boolean;
}

export interface AllowedDomain {
  id: number;
  domain: string;
  is_active: boolean;
  notes?: string | null;
  created_at: string;
}

// ─── Users / admin ───────────────────────────────────────────────────────────

export interface UserOut {
  id: number; email: string;
  username: string; full_name: string | null;
  role: UserRole; is_active: boolean; mfa_enabled?: boolean;
  last_login_at: string | null;
  created_at: string | null;
}

export interface SystemStats {
  users: { total: number; active: number; admins: number; clients: number };
  sessions: { active: number };
  emails: { total: number; processed: number; unprocessed: number };
  replies: { sent: number };
}

export interface FailedJob {
  id: number; job_name: string; args: unknown[] | null; job_key: string | null;
  attempts: number; error: string | null; status: "failed" | "retried" | "discarded";
  created_at: string | null; resolved_at: string | null;
}

// ─── Audit / API logs ─────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: number; user_id: number | null;
  action: string; resource_type: string | null;
  resource_id: number | null;
  ip_address: string | null; user_agent: string | null;
  status: string; details: Record<string, unknown> | null;
  created_at: string;
}

export interface ApiRequestLogEntry {
  id: number; user_id: number | null;
  method: string; path: string;
  query_params: string | null;
  status_code: number; response_time_ms: number | null;
  ip_address: string | null; user_agent: string | null;
  error_detail: string | null;
  created_at: string;
}

export interface LogsListResponse<T> {
  total: number; page: number;
  page_size: number; items: T[];
}

export interface LogsSummary {
  period_days: number;
  api_requests: {
    total: number; errors: number;
    error_rate_pct: number; avg_response_ms: number;
  };
  top_actions: Array<{ action: string; count: number }>;
  slowest_endpoints: Array<{ path: string; avg_ms: number }>;
  security: { failed_logins: number };
}
