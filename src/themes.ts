export type StaticThemeName =
  | "dark"
  | "light"
  | "tokyo-night"
  | "catppuccin"
  | "nord"
  | "github-dark"
  | "github-light";

export type ThemeName = StaticThemeName | "auto";

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
  /** Visual theme preset, or `"auto"` for automatic OS light/dark switching. Defaults to `"dark"`. */
  theme?: ThemeName;
  /** Enable CSS dash flow, pulsing hub ring, and SMIL `<animateMotion>` packets. Defaults to `true`. */
  animate?: boolean;
  /** Animation speed multiplier (`0.5` = half speed, `2` = double speed). Defaults to `1`. */
  speed?: number;
  /** Omit background card, dot grid, and ambient glows for transparent embedding. Defaults to `false`. */
  transparent?: boolean;
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
  blue: "#60A5FA",
  orange: "#FB923C",
  teal: "#2DD4BF",
  hub: "#38BDF8",
};

export const THEMES: Readonly<Record<StaticThemeName, ThemePalette>> = {
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
  "tokyo-night": {
    bg: "#1A1B26",
    dotColor: "rgba(169,177,214,0.14)",
    cardFill: "#24283B",
    cardStroke: "rgba(122,162,247,0.28)",
    hubBgStart: "#292E42",
    hubBgEnd: "#1F2335",
    titleColor: "#7AA2F7",
    textPrimary: "#C0CAF5",
    textMuted: "#9AA5CE",
    glowLeft: "#7AA2F7",
    glowRight: "#BB9AF7",
    glowOpacity: 0.16,
    wireBaseOpacity: 0.34,
  },
  catppuccin: {
    bg: "#1E1E2E",
    dotColor: "rgba(186,194,222,0.14)",
    cardFill: "#313244",
    cardStroke: "rgba(137,180,250,0.28)",
    hubBgStart: "#45475A",
    hubBgEnd: "#313244",
    titleColor: "#89B4FA",
    textPrimary: "#CDD6F4",
    textMuted: "#A6ADC8",
    glowLeft: "#89B4FA",
    glowRight: "#CBA6F7",
    glowOpacity: 0.16,
    wireBaseOpacity: 0.35,
  },
  nord: {
    bg: "#2E3440",
    dotColor: "rgba(216,222,233,0.14)",
    cardFill: "#3B4252",
    cardStroke: "rgba(136,192,208,0.3)",
    hubBgStart: "#434C5E",
    hubBgEnd: "#3B4252",
    titleColor: "#88C0D0",
    textPrimary: "#ECEFF4",
    textMuted: "#D8DEE9",
    glowLeft: "#88C0D0",
    glowRight: "#81A1C1",
    glowOpacity: 0.16,
    wireBaseOpacity: 0.36,
  },
  "github-dark": {
    bg: "#0D1117",
    dotColor: "rgba(139,148,158,0.16)",
    cardFill: "#161B22",
    cardStroke: "rgba(48,54,61,0.95)",
    hubBgStart: "#21262D",
    hubBgEnd: "#161B22",
    titleColor: "#58A6FF",
    textPrimary: "#F0F6FC",
    textMuted: "#8B949E",
    glowLeft: "#58A6FF",
    glowRight: "#A371F7",
    glowOpacity: 0.14,
    wireBaseOpacity: 0.35,
  },
  "github-light": {
    bg: "#FFFFFF",
    dotColor: "rgba(87,96,106,0.15)",
    cardFill: "#F6F8FA",
    cardStroke: "rgba(208,215,222,0.95)",
    hubBgStart: "#DDF4FF",
    hubBgEnd: "#F6F8FA",
    titleColor: "#0969DA",
    textPrimary: "#1F2328",
    textMuted: "#656D76",
    glowLeft: "#54AEFF",
    glowRight: "#A475F9",
    glowOpacity: 0.1,
    wireBaseOpacity: 0.4,
  },
};

export const THEME_NAMES: readonly ThemeName[] = [
  "dark",
  "light",
  "auto",
  "tokyo-night",
  "catppuccin",
  "nord",
  "github-dark",
  "github-light",
];
