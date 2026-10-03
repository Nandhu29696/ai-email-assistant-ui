"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Toaster from "@/components/UI/Toaster";
import { useState } from "react";
import { registerQueryClient } from "@/lib/api";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
    });
    registerQueryClient(client);
    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
