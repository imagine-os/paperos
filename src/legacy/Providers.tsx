"use client";

import { LiveblocksProvider } from "@liveblocks/react";
import { PropsWithChildren } from "react";
import { withBasePath } from "@/lib/env";

export function Providers({ children }: PropsWithChildren) {
  return (
    <LiveblocksProvider authEndpoint={withBasePath("/api/liveblocks-auth")} throttle={16}>
      {children}
    </LiveblocksProvider>
  );
}
