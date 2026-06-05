export const TYPOGRAPHY = {
  XL: {
    fontSize: "48px",
    lineHeight: "56px",
    fontWeight: 700,
  },

  MAIN_HEADING: {
    fontSize: "44px",
    lineHeight: "52px",
    fontWeight: 700,
  },

  H1: {
    fontSize: "24px",
    lineHeight: "32px",
    fontWeight: 500,
  },

  H2: {
    fontSize: "20px",
    lineHeight: "28px",
    fontWeight: 400,
  },

  BODY: {
    fontSize: "16px",
    lineHeight: "28px",
    fontWeight: 300,
  },

  BUTTON: {
    fontSize: "14px",
    lineHeight: "20px",
    fontWeight: 700,
  },
} as const;

type TypographyScale = typeof TYPOGRAPHY;

export const TYPOGRAPHY_CSS_VARIABLES = {
  "--typography-xl-font-size": TYPOGRAPHY.XL.fontSize,
  "--typography-xl-line-height": TYPOGRAPHY.XL.lineHeight,
  "--typography-xl-font-weight": TYPOGRAPHY.XL.fontWeight,

  "--typography-main-heading-font-size": TYPOGRAPHY.MAIN_HEADING.fontSize,
  "--typography-main-heading-line-height": TYPOGRAPHY.MAIN_HEADING.lineHeight,
  "--typography-main-heading-font-weight": TYPOGRAPHY.MAIN_HEADING.fontWeight,

  "--typography-h1-font-size": TYPOGRAPHY.H1.fontSize,
  "--typography-h1-line-height": TYPOGRAPHY.H1.lineHeight,
  "--typography-h1-font-weight": TYPOGRAPHY.H1.fontWeight,

  "--typography-h2-font-size": TYPOGRAPHY.H2.fontSize,
  "--typography-h2-line-height": TYPOGRAPHY.H2.lineHeight,
  "--typography-h2-font-weight": TYPOGRAPHY.H2.fontWeight,

  "--typography-body-font-size": TYPOGRAPHY.BODY.fontSize,
  "--typography-body-line-height": TYPOGRAPHY.BODY.lineHeight,
  "--typography-body-font-weight": TYPOGRAPHY.BODY.fontWeight,

  "--typography-button-font-size": TYPOGRAPHY.BUTTON.fontSize,
  "--typography-button-line-height": TYPOGRAPHY.BUTTON.lineHeight,
  "--typography-button-font-weight": TYPOGRAPHY.BUTTON.fontWeight,
} satisfies Record<`--${string}`, string | number>;

export type TypographyRole = keyof TypographyScale;

export const TYPOGRAPHY_CLASSES = {
  MAIN_HEADING:
    "text-4xl md:text-main-heading font-bold text-brand-heading mb-4 tracking-tight leading-tight",
  SUBHEADING:
    "text-2xl font-bold text-brand-heading tracking-tight",
  PRIMARY_BUTTON:
    "justify-center bg-brand-primary hover:bg-brand-hover",
} as const;
