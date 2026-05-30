import type { Metadata } from "next";
import AdminClient from "./AdminClient";

export const metadata: Metadata = {
  title: "Admin | Magpie",
  description: "Protocol economics dashboard for the Magpie creator wallet.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AdminClient />;
}
