"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      setThemeState(stored);
    }
  }, []);

  useEffect(() => {
    function apply(t: Theme) {
      const resolved: ResolvedTheme =
        t === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
          : t;
      setResolvedTheme(resolved);
      document.documentElement.classList.toggle("dark", resolved === "dark");
    }

    apply(theme);

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", () => apply("system"));
      return () => mq.removeEventListener("change", () => apply("system"));
    }
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem("theme", t);
    setThemeState(t);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
