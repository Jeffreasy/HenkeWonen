import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { getTheme, applyTheme, type Theme } from "../../lib/theme";

export function ThemeToggle() {
  // Lazy initializer: leest direct localStorage zodat de eerste render altijd klopt.
  // Zonder dit start de state altijd op "system" en moet je 2x klikken.
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return getTheme();
  });

  useEffect(() => {
    // Synchroniseer bij externe wijzigingen (andere tab, systeem OS-thema)
    const handleThemeChange = () => {
      setTheme(getTheme());
    };

    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      if (getTheme() === "system") {
        document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
      }
    };

    window.addEventListener("themechange", handleThemeChange);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      window.removeEventListener("themechange", handleThemeChange);
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  const handleToggle = () => {
    const nextTheme: Record<Theme, Theme> = {
      light: "dark",
      dark: "system",
      system: "light"
    };
    const next = nextTheme[theme];
    applyTheme(next);
  };

  const getLabel = () => {
    const labels: Record<Theme, string> = {
      light: "Licht thema actief",
      dark: "Donker thema actief",
      system: "Systeemthema actief"
    };
    return labels[theme];
  };

  return (
    <button
      onClick={handleToggle}
      className="ui-icon-button"
      title={`${getLabel()} (klik om te wijzigen)`}
      aria-label="Wissel thema"
      type="button"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "8px",
        borderRadius: "var(--radius-md)",
        background: "var(--surface-muted)",
        border: "1px solid var(--line)",
        cursor: "pointer",
        color: "var(--ink)",
        transition: "all 0.2s ease"
      }}
    >
      {theme === "light" && <Sun size={16} aria-hidden="true" />}
      {theme === "dark" && <Moon size={16} aria-hidden="true" />}
      {theme === "system" && <Monitor size={16} aria-hidden="true" />}
    </button>
  );
}
export default ThemeToggle;
