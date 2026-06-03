import type { Metadata } from "next";
import EmbedClient from "./EmbedClient";

export const metadata: Metadata = {
  title: "Embed Widget | Magpie",
  description:
    "Drop the 'Borrow against $X' button on your token's site or community page. Two lines of code. You earn 5% of every fee from users who join through your widget.",
  openGraph: {
    title: "Magpie Embed Widget",
    description:
      "Token communities — embed a 'Borrow against $X' button in 2 lines. Earn 5% lifetime fees from every user.",
  },
};

export default function Page() {
  return <EmbedClient />;
}
