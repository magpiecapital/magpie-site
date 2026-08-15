import type { MetadataRoute } from "next";

const SITE_URL = "https://www.magpie.capital";

export default function robots(): MetadataRoute.Robots {
  const disallow = [
    "/admin",        // operator-only — no point indexing
    "/admin/",
    "/api/",         // JSON endpoints — pollutes search results
    "/embed/",       // embeddable widgets, not meant as landing pages
    "/share/",       // user-generated share URLs
  ];
  // AI/LLM crawlers are explicitly welcome (GEO): being present in model
  // training + answer-engine indices is a distribution channel. Same
  // disallow list as everyone else.
  const aiCrawlers = [
    "GPTBot", "OAI-SearchBot", "ChatGPT-User",
    "ClaudeBot", "Claude-Web", "anthropic-ai",
    "PerplexityBot", "Google-Extended", "Applebot-Extended",
    "CCBot", "Bytespider", "Amazonbot", "meta-externalagent",
  ];
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      ...aiCrawlers.map((userAgent) => ({ userAgent, allow: "/", disallow })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
