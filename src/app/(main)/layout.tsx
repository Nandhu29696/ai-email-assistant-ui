"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import ActivityWatcher from "@/components/Layout/ActivityWatcher";
import { useAuthStore } from "@/store/authStore";
import { canSee, findNav } from "@/components/Layout/nav";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  // Pages this role may not open (e.g. a client typing /admin) go back to the dashboard.
  const page = findNav(pathname);
  const allowed = !page || canSee(page, user?.role);
  const [navOpen, setNavOpen] = useState(false);

  // Close the phone menu after navigating.
  useEffect(() => { setNavOpen(false); }, [pathname]);

  useEffect(() => {
    if (hydrated && !user) {
      router.replace("/login");
    } else if (hydrated && user && !allowed) {
      router.replace("/dashboard");
    }
  }, [hydrated, user, allowed, router]);

  // Prevent SSR/client mismatch while persisted auth state is loading.
  if (!hydrated) return null;
  if (!user || !allowed) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <ActivityWatcher />
      <Sidebar mobileOpen={navOpen} onClose={() => setNavOpen(false)} />
      <div className="flex h-screen min-w-0 flex-1 flex-col">
        <Header onMenu={() => setNavOpen(true)} />
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="fade-in mx-auto w-full max-w-[1400px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
