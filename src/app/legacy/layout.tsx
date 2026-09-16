import { Suspense } from "react";
import "@/legacy/globals.css";
import { Providers } from "@/legacy/Providers";

export const metadata = {
  title: "PaperOS - Legacy prototype (2025)",
};

/**
 * The 2025 prototype keeps its own Liveblocks provider tree. Without a
 * LIVEBLOCKS_SECRET_KEY the auth route answers with an error and the client
 * simply stays disconnected; the canvas still renders from its local store.
 */
export default function LegacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
      <Providers>{children}</Providers>
    </Suspense>
  );
}
