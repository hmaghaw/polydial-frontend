import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { ToastProvider } from "./ui/toast";

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: (n, e: any) => e?.status !== 401 && e?.status !== 404 && n < 2, refetchOnWindowFocus: false } } });
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <ToastProvider><AuthProvider>{children}</AuthProvider></ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
