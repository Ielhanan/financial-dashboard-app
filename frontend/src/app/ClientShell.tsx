"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useThemeStore } from "@/store/themeStore";
import { supabase } from "@/lib/supabase";
import { useWatchlistsStore } from "@/store/watchlistsStore";

function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      })
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function ThemeInit() {
  const init = useThemeStore((s) => s.init);
  useEffect(() => { init(); }, [init]);
  return null;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      if (!session) {
        if (pathname !== "/login") {
          router.replace("/login");
        } else {
          setReady(true);
        }
      } else {
        useWatchlistsStore.getState().loadFromSupabase(session.user.id).then(() => {
          setReady(true);
        });
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        useWatchlistsStore.getState().reset();
        router.replace("/login");
      } else if (event === "SIGNED_IN" && session) {
        useWatchlistsStore.getState().loadFromSupabase(session.user.id);
      }
    });

    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}

export default function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <ThemeInit />
      <AuthGuard>{children}</AuthGuard>
    </Providers>
  );
}
