export type ThemeName = "dark" | "light";

export interface ThemePalette {
  bg: string;
  dotColor: string;
  cardFill: string;
  cardStroke: string;
  hubBgStart: string;
  hubBgEnd: string;
  titleColor: string;
  textPrimary: string;
  textMuted: string;
  glowLeft: string;
  glowRight: string;
  glowOpacity: number;
  wireBaseOpacity: number;
}

export interface AnimateOptions {
  /** Optional uppercase header badge rendered above the diagram. */
  title?: string;
  /** Optional monospace footer pill rendered below the diagram. */
  footer?: string;
  /** Visual theme preset. Defaults to `"dark"`. */
  theme?: ThemeName;
  /** Enable CSS dash flow, pulsing hub ring, and SMIL `<animateMotion>` packets. Defaults to `true`. */
  animate?: boolean;
  /** Horizontal outer canvas padding in SVG units. Defaults to `52`. */
  padding?: number;
  /** Prefix for internal SVG IDs and CSS classes to avoid collisions when inlining multiple SVGs. Defaults to `"mmd"`. */
  idPrefix?: string;
  /** Accessible label for `aria-label`. Defaults to `title` or a generic description. */
  ariaLabel?: string;
}

export const ACCENT_PALETTE: Readonly<Record<string, string>> = {
  cyan: "#38BDF8",
  indigo: "#818CF8",
  amber: "#FBBF24",
  emerald: "#34D399",
  pink: "#F472B6",
  rose: "#FB7185",
  violet: "#A78BFA",
  hub: "#38BDF8",
};

export const THEMES: Readonly<Record<ThemeName, ThemePalette>> = {
  dark: {
    bg: "#070B14",
    dotColor: "rgba(148,163,184,0.14)",
    cardFill: "#0F172A",
    cardStroke: "rgba(148,163,184,0.24)",
    hubBgStart: "#1E293B",
    hubBgEnd: "#0F172A",
    titleColor: "#38BDF8",
    textPrimary: "#F8FAFC",
    textMuted: "#94A3B8",
    glowLeft: "#38BDF8",
    glowRight: "#818CF8",
    glowOpacity: 0.16,
    wireBaseOpacity: 0.32,
  },
  light: {
    bg: "#F8FAFC",
    dotColor: "rgba(100,116,139,0.18)",
    cardFill: "#FFFFFF",
    cardStroke: "rgba(148,163,184,0.45)",
    hubBgStart: "#EFF6FF",
    hubBgEnd: "#FFFFFF",
    titleColor: "#0284C7",
    textPrimary: "#0F172A",
    textMuted: "#475569",
    glowLeft: "#38BDF8",
    glowRight: "#818CF8",
    glowOpacity: 0.12,
    wireBaseOpacity: 0.38,
  },
};
