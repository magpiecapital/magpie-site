/**
 * /demo-video — headless-capture surface for exporting the walkthrough as an
 * mp4 (frame-by-frame via window.__demoSeek). Not linked anywhere; noindex.
 */
import type { Metadata } from "next";
import { DemoPlayer } from "@/components/DemoPlayer";

export const metadata: Metadata = {
  title: "Magpie demo — export surface",
  robots: { index: false, follow: false },
};

export default function DemoVideoPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <div id="capture-stage" className="w-[1280px]">
        <DemoPlayer exportMode />
      </div>
    </div>
  );
}
