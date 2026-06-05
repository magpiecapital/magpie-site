import type { Metadata } from "next";
import StatusClient from "./StatusClient";

export const metadata: Metadata = {
  title: "Status | Magpie",
  description: "Real-time health of the Magpie bot, API, and background services.",
};

export default function Page() {
  return <StatusClient />;
}
