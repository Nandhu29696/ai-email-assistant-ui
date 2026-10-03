import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Consistent page title block: icon tile, title, one-line description and optional actions. */
export default function PageHeader({ icon: Icon, title, description, actions }: {
  icon: LucideIcon; title: string; description?: ReactNode; actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3.5">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
          <Icon size={20} />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
          {description && <p className="mt-0.5 max-w-3xl text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
