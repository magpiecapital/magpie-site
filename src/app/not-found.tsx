import Link from "next/link";
import { Mark } from "@/components/Logo";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <div className="hop mb-8">
          <Mark size={80} />
        </div>

        <h1 className="font-display text-8xl font-medium tracking-[-0.04em] text-[var(--ink-faint)] md:text-9xl">
          404
        </h1>

        <p className="mt-4 text-xl font-medium text-[var(--ink)]">
          Page not found
        </p>
        <p className="mt-2 max-w-md text-base text-[var(--ink-soft)]">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/" className="btn-accent text-base">
            Back to home
            <span aria-hidden>→</span>
          </Link>
          <Link href="/docs" className="btn-ghost text-base">
            Documentation
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
