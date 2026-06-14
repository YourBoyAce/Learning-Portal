export const COLORS = {
  // Brand - Blue Palette
  PRIMARY: "#1682F1", // Azure Blue - Primary actions
  PRIMARY_DARK: "#174778", // Midnight Blue - Dark headers & sections
  PRIMARY_LIGHT: "#25C8E5", // Cyan Sky - Light highlights

  // Accents - Blue Variants
  ACCENT: "#1682F1", // Azure Blue - Main accent
  ACCENT_HOVER: "#0050DE", // Royal Blue - Hover state
  ACCENT_DARK: "#174778", // Midnight Blue - Dark accent
  ACCENT_DARK_HOVER: "#113a63", // Deeper midnight hover state
  ACCENT_ALT: "#2283FF", // Alternate azure used in legacy surfaces
  ACCENT_ALT_LIGHT: "#4A9CF8", // Lighter alternate azure for logo details
  INFO: "#1E9CD7", // Ocean Blue - Information elements
  SUCCESS: "#25C8E5", // Cyan Sky - Success & highlights
  HIGHLIGHT: "#4158FE", // Bright Blue - Special highlights & gradients

  // Text
  TEXT_PRIMARY: "#233036",
  TEXT_SECONDARY: "#666666",
  TEXT_MUTED: "#CCCCCC",
  TEXT_DARK: "#0f172a",
  TEXT_NAVY: "#1a2536",

  // Background
  BACKGROUND: "#FFFFFF",
  CARD: "#FFFFFF",
  PAGE: "#F5F7FA",
  PAGE_SUBTLE: "#F8FAFC",
  ACCENT_SURFACE: "#F0F7FF",
  ACCENT_SURFACE_START: "#E8F2FF",
  ACCENT_SURFACE_END: "#F0F8FF",
  INPUT_SURFACE: "#F0F2F5",
  VIDEO_SURFACE: "#111827",

  // Utility
  WHITE: "#FFFFFF",
  BLACK: "#000000",
  BLACK_SOFT: "#0a0a0f",

  // Borders
  BORDER: "#E5E7EB",
  BORDER_BLUE: "#D0E8F2", // Light blue border for blue theme

  // Gradients
  GRADIENT_PRIMARY: "linear-gradient(135deg, #174778 0%, #1682F1 100%)", // Midnight to Azure
  GRADIENT_ACCENT: "linear-gradient(135deg, #1682F1 0%, #25C8E5 100%)", // Azure to Cyan
  GRADIENT_HIGHLIGHT: "linear-gradient(135deg, #4158FE 0%, #1E9CD7 100%)", // Bright to Ocean
};

export const COLOR_CSS_VARIABLES = {
  "--color-primary": COLORS.PRIMARY,
  "--color-primary-dark": COLORS.PRIMARY_DARK,
  "--color-primary-light": COLORS.PRIMARY_LIGHT,
  "--color-accent": COLORS.ACCENT,
  "--color-accent-hover": COLORS.ACCENT_HOVER,
  "--color-accent-dark": COLORS.ACCENT_DARK,
  "--color-accent-dark-hover": COLORS.ACCENT_DARK_HOVER,
  "--color-accent-alt": COLORS.ACCENT_ALT,
  "--color-accent-alt-light": COLORS.ACCENT_ALT_LIGHT,
  "--color-info": COLORS.INFO,
  "--color-success": COLORS.SUCCESS,
  "--color-highlight": COLORS.HIGHLIGHT,
  "--color-text-primary": COLORS.TEXT_PRIMARY,
  "--color-text-secondary": COLORS.TEXT_SECONDARY,
  "--color-text-muted": COLORS.TEXT_MUTED,
  "--color-text-dark": COLORS.TEXT_DARK,
  "--color-text-navy": COLORS.TEXT_NAVY,
  "--color-background": COLORS.BACKGROUND,
  "--color-card": COLORS.CARD,
  "--color-page": COLORS.PAGE,
  "--color-page-subtle": COLORS.PAGE_SUBTLE,
  "--color-accent-surface": COLORS.ACCENT_SURFACE,
  "--color-accent-surface-start": COLORS.ACCENT_SURFACE_START,
  "--color-accent-surface-end": COLORS.ACCENT_SURFACE_END,
  "--color-input-surface": COLORS.INPUT_SURFACE,
  "--color-video-surface": COLORS.VIDEO_SURFACE,
  "--color-white": COLORS.WHITE,
  "--color-black": COLORS.BLACK,
  "--color-black-soft": COLORS.BLACK_SOFT,
  "--color-border": COLORS.BORDER,
  "--color-border-blue": COLORS.BORDER_BLUE,
} satisfies Record<`--${string}`, string>;

export const DARK_COLORS = {
  // Brand - Blue Palette (brighter for dark backgrounds)
  PRIMARY: "#60a5fa",
  PRIMARY_DARK: "#93c5fd",
  PRIMARY_LIGHT: "#38bdf8",

  // Accents - Blue Variants
  ACCENT: "#60a5fa",
  ACCENT_HOVER: "#3b82f6",
  ACCENT_DARK: "#93c5fd",
  ACCENT_DARK_HOVER: "#bfdbfe",
  ACCENT_ALT: "#60a5fa",
  ACCENT_ALT_LIGHT: "#93c5fd",
  INFO: "#38bdf8",
  SUCCESS: "#34d399",
  HIGHLIGHT: "#818cf8",

  // Text
  TEXT_PRIMARY: "#f1f5f9",
  TEXT_SECONDARY: "#94a3b8",
  TEXT_MUTED: "#475569",
  TEXT_DARK: "#e2e8f0",
  TEXT_NAVY: "#cbd5e1",

  // Background
  BACKGROUND: "#0f172a",
  CARD: "#1e293b",
  PAGE: "#0f172a",
  PAGE_SUBTLE: "#1e293b",
  ACCENT_SURFACE: "rgba(22, 130, 241, 0.08)",
  ACCENT_SURFACE_START: "rgba(22, 130, 241, 0.06)",
  ACCENT_SURFACE_END: "rgba(22, 130, 241, 0.03)",
  INPUT_SURFACE: "#1e293b",
  VIDEO_SURFACE: "#0f172a",

  // Utility
  WHITE: "#FFFFFF",
  BLACK: "#000000",
  BLACK_SOFT: "#0a0a0f",

  // Borders
  BORDER: "rgba(255, 255, 255, 0.1)",
  BORDER_BLUE: "rgba(96, 165, 250, 0.2)",

  // Gradients
  GRADIENT_PRIMARY: "linear-gradient(135deg, #1e3a5f 0%, #3b82f6 100%)",
  GRADIENT_ACCENT: "linear-gradient(135deg, #3b82f6 0%, #38bdf8 100%)",
  GRADIENT_HIGHLIGHT: "linear-gradient(135deg, #818cf8 0%, #38bdf8 100%)",
};

export const DARK_COLOR_CSS_VARIABLES = {
  "--color-primary": DARK_COLORS.PRIMARY,
  "--color-primary-dark": DARK_COLORS.PRIMARY_DARK,
  "--color-primary-light": DARK_COLORS.PRIMARY_LIGHT,
  "--color-accent": DARK_COLORS.ACCENT,
  "--color-accent-hover": DARK_COLORS.ACCENT_HOVER,
  "--color-accent-dark": DARK_COLORS.ACCENT_DARK,
  "--color-accent-dark-hover": DARK_COLORS.ACCENT_DARK_HOVER,
  "--color-accent-alt": DARK_COLORS.ACCENT_ALT,
  "--color-accent-alt-light": DARK_COLORS.ACCENT_ALT_LIGHT,
  "--color-info": DARK_COLORS.INFO,
  "--color-success": DARK_COLORS.SUCCESS,
  "--color-highlight": DARK_COLORS.HIGHLIGHT,
  "--color-text-primary": DARK_COLORS.TEXT_PRIMARY,
  "--color-text-secondary": DARK_COLORS.TEXT_SECONDARY,
  "--color-text-muted": DARK_COLORS.TEXT_MUTED,
  "--color-text-dark": DARK_COLORS.TEXT_DARK,
  "--color-text-navy": DARK_COLORS.TEXT_NAVY,
  "--color-background": DARK_COLORS.BACKGROUND,
  "--color-card": DARK_COLORS.CARD,
  "--color-page": DARK_COLORS.PAGE,
  "--color-page-subtle": DARK_COLORS.PAGE_SUBTLE,
  "--color-accent-surface": DARK_COLORS.ACCENT_SURFACE,
  "--color-accent-surface-start": DARK_COLORS.ACCENT_SURFACE_START,
  "--color-accent-surface-end": DARK_COLORS.ACCENT_SURFACE_END,
  "--color-input-surface": DARK_COLORS.INPUT_SURFACE,
  "--color-video-surface": DARK_COLORS.VIDEO_SURFACE,
  "--color-white": DARK_COLORS.WHITE,
  "--color-black": DARK_COLORS.BLACK,
  "--color-black-soft": DARK_COLORS.BLACK_SOFT,
  "--color-border": DARK_COLORS.BORDER,
  "--color-border-blue": DARK_COLORS.BORDER_BLUE,
} satisfies Record<`--${string}`, string>;
