import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "./Icons";

type Theme = "light" | "dark";

/**
 * Light/dark switch. The initial theme is applied before hydration by an
 * inline script in root.tsx (this component renders on the server too, so it
 * cannot touch window/localStorage during render); it syncs with the applied
 * theme on mount and owns it from the first interaction.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    if (document.documentElement.getAttribute("data-theme") === "dark") {
      setTheme("dark");
    }
  }, []);

  const apply = (next: Theme) => {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  return (
    <label className="btn btn-ghost btn-square swap swap-rotate" aria-label="Toggle color theme">
      <input
        type="checkbox"
        checked={theme === "dark"}
        onChange={(e) => apply(e.target.checked ? "dark" : "light")}
      />
      <SunIcon className="swap-off h-5 w-5" />
      <MoonIcon className="swap-on h-5 w-5" />
    </label>
  );
}
