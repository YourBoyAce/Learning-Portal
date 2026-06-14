"use client";

import { useTheme } from "@/app/context/ThemeContext";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      aria-label={isDark ? "Dark mode active (system)" : "Light mode active (system)"}
      className="
        relative w-10 h-10
        flex items-center justify-center
        rounded-xl
        border border-white/20
        bg-white/10
        hover:bg-white/20
        text-white
        transition-all duration-300
        cursor-pointer
        overflow-hidden
        group
      "
    >
      {/* Sun icon */}
      <Sun
        size={18}
        className={`
          absolute transition-all duration-300 ease-in-out
          ${isDark
            ? "opacity-100 rotate-0 scale-100"
            : "opacity-0 rotate-90 scale-0"
          }
        `}
      />
      {/* Moon icon */}
      <Moon
        size={18}
        className={`
          absolute transition-all duration-300 ease-in-out
          ${isDark
            ? "opacity-0 -rotate-90 scale-0"
            : "opacity-100 rotate-0 scale-100"
          }
        `}
      />

      {/* Hover glow ring */}
      <span className="absolute inset-0 rounded-xl ring-0 group-hover:ring-2 ring-white/20 transition-all duration-300" />
    </button>
  );
}
