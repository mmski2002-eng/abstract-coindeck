"use client";

import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createWagmiConfig } from "@/lib/wagmi";

export function Providers({ children }: { children: React.ReactNode }) {
  const [{ config, queryClient }] = useState(() => ({
    config: createWagmiConfig(),
    queryClient: new QueryClient(),
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        {children}
      </WagmiProvider>
    </QueryClientProvider>
  );
}
