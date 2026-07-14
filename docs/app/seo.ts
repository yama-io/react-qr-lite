import type { MetaDescriptor } from "react-router";

export const SITE_URL = "https://yama-io.github.io/react-qr-lite";
export const SITE_NAME = "react-qr-lite";

interface SeoArgs {
  title: string;
  description: string;
  /** Route path with a trailing slash ("/", "/api/", ...) — GitHub Pages
   * 301-redirects directory URLs to the trailing-slash form, so canonical
   * and og:url must use it. */
  path: string;
}

/** Meta descriptors shared by every indexable page: title/description,
 * canonical URL, Open Graph and Twitter Card tags. */
export function seoMeta({ title, description, path }: SeoArgs): MetaDescriptor[] {
  const url = `${SITE_URL}${path}`;
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:locale", content: "en_US" },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
}
