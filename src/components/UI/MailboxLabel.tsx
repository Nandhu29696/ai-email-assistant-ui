import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";

const PROVIDER_COLOR: Record<string, string> = {
  gmail: "bg-red-50 text-red-600",
  outlook: "bg-sky-50 text-sky-700",
  imap: "bg-slate-100 text-slate-600",
};

/** "Which mailbox": provider-coloured icon + address. */
export default function MailboxLabel({ email, provider, compact = false, className }: {
  email: string | null | undefined; provider?: string | null; compact?: boolean; className?: string;
}) {
  if (!email) return <span className="text-slate-400">—</span>;
  return (
    <span className={cn("inline-flex min-w-0 max-w-full items-center gap-1.5", className)} title={provider ? `${email} (${provider})` : email}>
      <span className={cn("flex flex-shrink-0 items-center justify-center rounded-md", compact ? "h-5 w-5" : "h-6 w-6", PROVIDER_COLOR[provider ?? ""] ?? PROVIDER_COLOR.imap)}>
        <Mail size={compact ? 11 : 13} />
      </span>
      <span className="truncate">{email}</span>
    </span>
  );
}
