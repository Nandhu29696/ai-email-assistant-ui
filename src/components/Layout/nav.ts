import {
  Inbox, LayoutDashboard, ListChecks, Mail, ScrollText, Settings, ShieldCheck, Users,
} from "lucide-react";
import type { UserRole } from "@/types";

export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: typeof Mail;
  /** Only these roles see the page (default: everyone signed in). */
  roles?: UserRole[];
}

export const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", description: "How every email was handled", icon: LayoutDashboard },
      { href: "/emails", label: "Processed emails", description: "Each email, its rule, replies and PDFs", icon: Inbox },
    ],
  },
  {
    title: "Configuration",
    items: [
      { href: "/mailboxes", label: "Mailboxes", description: "Connected mailboxes and their rules", icon: Mail },
      { href: "/rules", label: "Rules & replies", description: "Valid domains and automatic replies", icon: ListChecks },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/admin", label: "Users & jobs", description: "Users, alerts and failed background jobs", icon: ShieldCheck, roles: ["admin"] },
      { href: "/logs", label: "Logs", description: "Audit trail and API requests", icon: ScrollText, roles: ["admin"] },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/team", label: "Team", description: "Users who work with your mailboxes", icon: Users, roles: ["client"] },
      { href: "/settings", label: "Settings", description: "Password, two-factor, sessions and notifications", icon: Settings },
    ],
  },
];

export function canSee(item: Pick<NavItem, "roles">, role: UserRole | undefined): boolean {
  return !item.roles || (!!role && item.roles.includes(role));
}

export function findNav(pathname: string): (NavItem & { group: string }) | undefined {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((i) => pathname.startsWith(i.href));
    if (item) return { ...item, group: group.title };
  }
  return undefined;
}
