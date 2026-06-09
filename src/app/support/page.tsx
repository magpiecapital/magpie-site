import type { Metadata } from "next";
import SupportClient from "./SupportClient";

export const metadata: Metadata = {
  title: "Support | Magpie",
  description:
    "Open a support ticket on magpie.capital. Connect your wallet and reach the Magpie team directly — Pip answers first, the team takes over if it can't.",
};

export default function SupportPage() {
  return <SupportClient />;
}
