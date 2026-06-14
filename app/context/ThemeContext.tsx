"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { COLOR_CSS_VARIABLES, DARK_COLOR_CSS_VARIABLES } from "@/app/styles/colors";
import { TYPOGRAPHY_CSS_VARIABLES } from "@/app/styles/typography";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyThemeVariables(theme: Theme) {
  const root = document.documentElement;
  const vars = theme === "dark" ? DARK_COLOR_CSS_VARIABLES : COLOR_CSS_VARIABLES;

  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }

  for (const [key, value] of Object.entries(TYPOGRAPHY_CSS_VARIABLES)) {
    root.style.setProperty(key, String(value));
  }

  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const initial = getSystemTheme();
    setTheme(initial);
    applyThemeVariables(initial);
    setMounted(true);

    const handleChange = (e: MediaQueryListEvent) => {
      const next: Theme = e.matches ? "dark" : "light";
      setTheme(next);
      applyThemeVariables(next);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: mounted ? theme : "light" }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
