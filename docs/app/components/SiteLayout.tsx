import { useState } from "react";
import { NavLink, Outlet } from "react-router";
import { GitHubIcon, LogoIcon, MenuIcon } from "./Icons";
import { ThemeToggle } from "./ThemeToggle";

export const GITHUB_URL = "https://github.com/yama-io/react-qr-lite";
export const NPM_URL = "https://www.npmjs.com/package/react-qr-lite";

const NAV_ITEMS = [
  { to: "/", label: "Home", end: true },
  { to: "/getting-started", label: "Getting Started", end: false },
  { to: "/api", label: "API Reference", end: false },
  { to: "/examples", label: "Examples", end: false },
  { to: "/playground", label: "Playground", end: false },
];

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? "menu-active" : "";
}

/** Site chrome: responsive drawer + navbar + footer around the routed page. */
export function SiteLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="drawer">
      <input
        id="site-drawer"
        type="checkbox"
        className="drawer-toggle"
        checked={drawerOpen}
        onChange={(e) => setDrawerOpen(e.target.checked)}
      />

      <div className="drawer-content flex min-h-screen flex-col">
        <header className="navbar bg-base-200 sticky top-0 z-30 shadow-sm">
          <div className="navbar-start">
            <label
              htmlFor="site-drawer"
              aria-label="Open menu"
              className="btn btn-ghost btn-square lg:hidden"
            >
              <MenuIcon />
            </label>
            <NavLink to="/" className="btn btn-ghost gap-2 px-2 text-lg normal-case">
              <LogoIcon />
              react-qr-lite
            </NavLink>
          </div>

          <nav aria-label="Main navigation" className="navbar-center hidden lg:flex">
            <ul className="menu menu-horizontal px-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.end} className={navLinkClass}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="navbar-end gap-1">
            <ThemeToggle />
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost btn-square"
              aria-label="GitHub repository"
            >
              <GitHubIcon />
            </a>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl grow px-4 py-8 lg:px-8">
          <Outlet />
        </main>

        <footer className="footer footer-center bg-base-200 text-base-content gap-4 p-8">
          <nav className="grid grid-flow-col gap-4">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="link link-hover">
              GitHub
            </a>
            <a href={NPM_URL} target="_blank" rel="noreferrer" className="link link-hover">
              npm
            </a>
            <a
              href={`${GITHUB_URL}/blob/main/LICENSE`}
              target="_blank"
              rel="noreferrer"
              className="link link-hover"
            >
              MIT License
            </a>
          </nav>
          <aside>
            <p>react-qr-lite — fast, tiny QR code generator for React. Zero dependencies.</p>
          </aside>
        </footer>
      </div>

      <div className="drawer-side z-40">
        <label htmlFor="site-drawer" aria-label="Close menu" className="drawer-overlay" />
        <nav aria-label="Mobile navigation" className="bg-base-100 min-h-full w-72">
          <ul className="menu text-base-content w-full p-4">
            <li className="menu-title">react-qr-lite</li>
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={navLinkClass}
                  onClick={() => setDrawerOpen(false)}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
