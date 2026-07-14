import type { ReactNode } from "react";
import { Links, Meta, Scripts, ScrollRestoration } from "react-router";
import { SiteLayout } from "./components/SiteLayout";
import { SITE_URL } from "./seo";
import "./app.css";

// Applies the persisted daisyUI theme before first paint (prerendered HTML
// has no data-theme, so without this a dark-mode visitor would see a flash
// of the light theme).
const THEME_INIT = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

// schema.org structured data describing the library, embedded on every page.
const JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SoftwareSourceCode",
  name: "react-qr-lite",
  description:
    "Fast, tiny QR code generator for React (SVG output). Zero dependencies; from-scratch ISO/IEC 18004 encoder.",
  url: `${SITE_URL}/`,
  codeRepository: "https://github.com/yama-io/react-qr-lite",
  programmingLanguage: "TypeScript",
  runtimePlatform: "React",
  license: "https://opensource.org/license/mit/",
  author: { "@type": "Person", name: "yama-io" },
});

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="icon"
          type="image/svg+xml"
          href={`${import.meta.env.BASE_URL}favicon.svg`}
        />
        <Meta />
        <Links />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON_LD }} />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  return <SiteLayout />;
}
