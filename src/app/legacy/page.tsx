"use client";

import Link from "next/link";
import { Room } from "@/legacy/Room";
import { StorageTldraw } from "@/legacy/StorageTldraw";

/**
 * IMPORTANT: LICENSE REQUIRED
 * To use tldraw commercially, you must first purchase a license
 * Learn more: https://tldraw.dev/community/license
 */

export default function LegacyPage() {
  return (
    <div className="legacy-shell">
      <div className="legacy-banner" role="banner">
        <span>Legacy prototype (2025).</span>
        <Link href="/">Back to PaperOS v2 &rarr;</Link>
      </div>
      <div className="legacy-canvas">
        <Room>
          <StorageTldraw />
        </Room>
      </div>
    </div>
  );
}
