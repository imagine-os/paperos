import type { Metadata } from "next";
import { DesktopLoader } from "@/desktop/desktop-loader";

export const metadata: Metadata = {
  title: "PaperOS - Desktop",
  description:
    "The PaperOS v2 desktop: windows, tiling, an IDE, data and pages on a zoomable canvas.",
};

export default function AppPage() {
  return <DesktopLoader />;
}
