export type Theme = "light" | "dark" | "system";

export function getTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return (localStorage.getItem("theme") as Theme) || "system";
}

export function applyTheme(theme: Theme) {
  if (typeof window === "undefined") return;

  localStorage.setItem("theme", theme);

  let resolvedTheme = theme;
  if (theme === "system") {
    resolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  document.documentElement.setAttribute("data-theme", resolvedTheme);
  
  // Set cookie for Astro SSR (valid for 1 year)
  document.cookie = `theme=${resolvedTheme}; path=/; max-age=31536000; SameSite=Lax`;

  window.dispatchEvent(new Event("themechange"));
}
