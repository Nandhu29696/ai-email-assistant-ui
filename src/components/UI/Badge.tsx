import { cn } from "@/lib/utils";
import { TONE_CLASSES, type Tone } from "@/lib/intake";
import type { ReactNode } from "react";

export default function Badge({ children, tone = "slate", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", TONE_CLASSES[tone], className)}>
      {children}
    </span>
  );
}
