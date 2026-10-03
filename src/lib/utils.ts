import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return format(new Date(iso), "MMM d, yyyy h:mm a");
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
