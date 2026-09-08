// ─── Core domain types matching backend schemas ───────────────────────────────

export type Sentiment = "positive" | "neutral" | "negative";
export type Priority  = "critical" | "high" | "medium" | "low";
export type Category  =
  | "complaint" | "support" | "sales" | "refund"
  | "invoice"   | "feedback" | "general";
export type Emotion   =
  | "anger" | "frustration" | "urgency" | "concern"
  | "satisfaction" | "excitement" | "neutral";
export type Provider  = "gmail" | "outlook" | "imap";
export type UserRole  = "admin" | "client";
export type TrackerStatus = "pending" | "replied" | "escalated" | "ignored";

export interface EmotionItem { emotion: Emotion; score: number; }

export interface EmailAnalysis {
  id: number; email_id: number;
  sentiment: Sentiment; sentiment_score: number;
  primary_emotion: Emotion; emotions_json: EmotionItem[];
  category: Category; category_confidence: number;
  priority: Priority; priority_score: number;
  ai_summary: string; suggested_reply: string;
  routed_to: string; routing_reason: string;
  model_version: string; processing_time_ms: number;
  created_at: string;
}

export interface Email {
  id: number; message_id: string;
  subject: string; sender_name: string;
  sender_email: string; recipient_email: string;
  body_plain: string; body_clean: string;
  received_at: string; processed_at: string | null;
  is_read: boolean; is_archived: boolean;
  thread_id: string | null;
  analysis: EmailAnalysis | null;
  created_at: string;
}

export interface EmailListOut {
  items: Email[]; total: number;
  page: number; page_size: number;
}

export interface EmailUpdateRequest { is_read?: boolean; is_archived?: boolean; }

export interface Integration {
  id: number; provider: Provider;
  email_address: string; is_active: boolean;
  owner_user_id?: number | null;
  batch_prefix?: string | null; mailbox_type?: "PROD" | "UAT" | "DEV";
  processing_mode?: "conversation" | "document_intake" | "both";
  conversation_analysis_enabled?: boolean;
  allowed_extensions?: string | null; max_file_size_mb?: number | null;
  success_auto_reply_enabled?: boolean; failure_auto_reply_enabled?: boolean;
  success_folder_label?: string | null; failed_folder_label?: string | null;
  storage_provider?: "local" | "azure_blob";
  callback_webhook_url?: string | null; callback_enabled?: boolean;
  retention_days?: number | null;
  last_sync_at?: string | null; last_email_processed_at?: string | null;
  health_status?: "healthy" | "degraded" | "error" | "unknown"; health_message?: string | null;
  created_at: string;
}

export interface Notification {
  id: string | number; email_id: string | number;
  type: string; title: string;
  message: string; is_read: boolean;
  created_at: string;
}

// ─── Lookup types ─────────────────────────────────────────────────────────────

export interface SentimentOption { id: number; value: string; label: string; color?: string; sort_order: number; }
export interface PriorityOption  { id: number; value: string; label: string; color?: string; score?: number; sort_order: number; }
export interface CategoryOption  { id: number; value: string; label: string; description?: string; sort_order: number; }

// ─── Reply types ──────────────────────────────────────────────────────────────

export interface EmailReply {
  id: number; email_id: number;
  subject: string | null; body: string;
  attachments_json: Array<{ filename: string; size?: number }>;
  is_draft: boolean; sent_at: string | null;
  created_at: string;
}

export interface ReplyCreate {
  subject?: string; body: string;
  attachments?: Array<{ filename: string; size?: number }>;
  send?: boolean;
}

// ─── Domain whitelist ─────────────────────────────────────────────────────────

export interface AllowedDomain {
  id: number; domain: string;
  is_active: boolean; notes?: string | null;
  created_at: string;
}

// ─── Dashboard types ──────────────────────────────────────────────────────────

export interface SentimentBreakdown { positive: number; neutral: number; negative: number; }
export interface PriorityBreakdown  { critical: number; high: number; medium: number; low: number; }
export interface CategoryBreakdown  { complaint: number; support: number; sales: number; refund: number; invoice: number; feedback: number; general: number; }

export interface TrendPoint {
  date: string; positive: number;
  neutral: number; negative: number;
  total: number;
}

export interface DashboardStats {
  total_emails: number; unread_emails: number;
  processed_emails: number; critical_emails: number;
  avg_sentiment_score: number;
  sentiment: SentimentBreakdown;
  priority: PriorityBreakdown;
  category: CategoryBreakdown;
}

export interface TrendsResponse { trends: TrendPoint[]; period_days: number; }

export interface EmailFilters {
  page?: number; page_size?: number;
  sentiment?: Sentiment; priority?: Priority;
  category?: Category; is_read?: boolean;
  search?: string;
}

// ─── User / Auth types ────────────────────────────────────────────────────────

export interface UserOut {
  id: number; email: string;
  username: string; full_name: string | null;
  role: UserRole; is_active: boolean;
  last_login_at: string | null;
  created_at: string | null;
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

// ─── Reply tracker ────────────────────────────────────────────────────────────

export interface ReplyTrackerItem {
  tracker_id: number; email_id: number;
  subject: string | null; sender_email: string | null;
  received_at: string | null; status: TrackerStatus;
  priority: Priority | null;
  first_response_minutes: number | null;
  sla_threshold_minutes: number;
  sla_breach: boolean;
  escalated_to: string | null; notes: string | null;
  updated_at: string | null;
}

export interface ReplyTrackerSummary {
  period_days: number; total_tracked: number;
  status_breakdown: Record<string, number>;
  sla_breaches: number; sla_breach_rate_pct: number;
  avg_response_minutes: number;
  breach_by_priority: Array<{ priority: string; count: number }>;
}

export interface SystemStats {
  users: { total: number; active: number; admins: number; employees: number };
  sessions: { active: number };
  emails: { total: number; processed: number; unprocessed: number };
  replies: { total: number; sent: number; drafts: number };
}
