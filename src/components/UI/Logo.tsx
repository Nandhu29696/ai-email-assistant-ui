import { cn } from "@/lib/utils";

/** App mark: an envelope with a "processed" check — same artwork as the browser-tab icon (app/icon.svg). */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="mailai-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#mailai-logo-bg)" />
      <rect x="10" y="18" width="36" height="26" rx="4" fill="#fff" />
      <path d="M11.5 20.5 28 33l16.5-12.5" fill="none" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="46" cy="44" r="11" fill="#10b981" stroke="#fff" strokeWidth="3" />
      <path d="m40.5 44.2 3.7 3.6 7.3-7.4" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Logo({ collapsed = false, dark = false, className }: { collapsed?: boolean; dark?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={32} />
      {!collapsed && (
        <span className="leading-tight">
          <span className={cn("block text-[15px] font-bold tracking-tight", dark ? "text-white" : "text-slate-900")}>MailAI</span>
          <span className={cn("block text-[10px] font-medium uppercase tracking-[0.14em]", dark ? "text-indigo-200/70" : "text-slate-400")}>Email intake</span>
        </span>
      )}
    </span>
  );
}
