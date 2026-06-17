"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { COLOR_CSS_VARIABLES } from "@/app/styles/colors";
import { TYPOGRAPHY_CSS_VARIABLES } from "@/app/styles/typography";

type Theme = "light";

interface ThemeContextValue {
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyThemeVariables(theme: Theme) {
  const root = document.documentElement;
  const vars = COLOR_CSS_VARIABLES;

  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }

  for (const [key, value] of Object.entries(TYPOGRAPHY_CSS_VARIABLES)) {
    root.style.setProperty(key, String(value));
  }

}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial: Theme = "light";
    setTheme(initial);
    applyThemeVariables(initial);
    setMounted(true);
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
