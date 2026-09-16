"use client";

import dynamic from "next/dynamic";

// tldraw touches window/document, so the desktop only renders in the browser.
const Desktop = dynamic(() => import("./desktop").then((m) => m.Desktop), {
  ssr: false,
  loading: () => <div className="pos-loading">Loading PaperOS...</div>,
});

export function DesktopLoader() {
  return <Desktop />;
}
