import type { MetadataRoute } from "next";

const SITE_URL = "https://magpie.capital";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",        // operator-only — no point indexing
        "/admin/",
        "/api/",         // JSON endpoints — pollutes search results
        "/embed/",       // embeddable widgets, not meant as landing pages
        "/share/",       // user-generated share URLs
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
