import type { MetadataRoute } from "next";
import { FULL_CATALOG } from "@/lib/collectibles-catalog";

const SITE_URL = "https://www.magpie.capital";

/**
 * One /borrow/<symbol> landing page per approved collateral token.
 * Sourced from the live catalog so the sitemap can never advertise a
 * delisted token; failures degrade to the static routes only.
 */
async function borrowPages(now: Date): Promise<MetadataRoute.Sitemap> {
  try {
    const res = await fetch(`${SITE_URL}/api/v1/tokens?limit=500`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const d = (await res.json()) as { tokens?: Array<{ symbol: string }> };
    // Collided symbols are excluded entirely — the borrow page refuses
    // to guess between two tokens sharing a ticker, so their URLs 404.
    const counts = new Map<string, number>();
    for (const t of d.tokens ?? []) {
      const s = t.symbol.toLowerCase();
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return (d.tokens ?? [])
      .filter((t) => {
        const s = t.symbol.toLowerCase();
        return /^[a-z0-9$._-]{1,20}$/.test(s) && counts.get(s) === 1;
      })
      .map((t) => ({
        url: `${SITE_URL}/borrow/${encodeURIComponent(t.symbol.toLowerCase())}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.75,
      }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const tokenPages = await borrowPages(now);
  const collectiblePages: MetadataRoute.Sitemap = FULL_CATALOG.map((i) => ({
    url: `${SITE_URL}/collectibles/${i.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));
  return [
    ...tokenPages,
    ...collectiblePages,
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/tokens`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/demo`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/dashboard`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/calculate`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/credit`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      // x402 agent-API marketing page — high SEO priority because it's the
      // novel-positioning surface (first paid lending API on Solana).
      url: `${SITE_URL}/x402`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/docs`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/stats`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/points`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/changelog`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/security`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/whitepaper`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      // Token landing page — single URL for listing reviewers + skeptics
      // to consolidate contract, supply, and explorer links.
      url: `${SITE_URL}/magpie`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/tokenomics`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      // Support entry point — discoverable from header nav so non-TG
      // users (and any first-time visitor) can find help without
      // digging into the dashboard.
      url: `${SITE_URL}/support`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/earn`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/holders`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/vs`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/marketplace`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/leaderboard`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/refer`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/submit`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      // Canonical "all four official surfaces" page. High priority
      // because reviewers + new users land here to verify legitimacy.
      url: `${SITE_URL}/links`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.95,
    },
    {
      // Tokenized-stock landing page — focused marketing surface for the
      // xStock collateral product (vol-aware LTV tiers, weekend cutoff,
      // 5-layer scam defense). High SEO priority because it's the
      // strategic positioning page that the rest of the funnel feeds.
      url: `${SITE_URL}/xstocks`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      // Collectibles landing page — the design-phase vertical (fixed-term
      // loans against tokenized graded trading cards, real-comp valuation,
      // buyback exit). Marketing surface for the third collateral class;
      // marked in-design until the data/legal/audit gates close.
      url: `${SITE_URL}/collectibles`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      // Tokenize-to-borrow funnel — approved-but-unvaulted submissions
      // route here; the partner story in product form.
      url: `${SITE_URL}/collectibles/tokenize`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: `${SITE_URL}/status`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
  ];
}
