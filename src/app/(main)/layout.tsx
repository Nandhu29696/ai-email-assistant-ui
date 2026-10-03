"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import ActivityWatcher from "@/components/Layout/ActivityWatcher";
import { useAuthStore } from "@/store/authStore";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    if (hydrated && !user) {
      router.replace("/login");
    }
  }, [hydrated, user, router]);

  // Prevent SSR/client mismatch while persisted auth state is loading.
  if (!hydrated) return null;
  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <ActivityWatcher />
      <Sidebar />
      <div className="flex h-screen min-w-0 flex-1 flex-col">
        <Header />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="fade-in mx-auto w-full max-w-[1400px] px-6 py-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
