import { extendTheme, type ThemeConfig } from "@chakra-ui/react";

/**
 * Design tokens.
 *
 * Dark carbon surfaces with white type, in the spirit of an operating-room
 * console. Blue is the only interaction accent and is never used for an alert
 * state, so the semantic ramp (critical / warning / info / healthy) reads
 * unambiguously on the floor map.
 */
const config: ThemeConfig = {
  initialColorMode: "dark",
  useSystemColorMode: false,
};

export const tone = {
  critical: "#E5484D",
  warning: "#F5B301",
  info: "#82888F",
  healthy: "#3DBE8B",
  idle: "#4A525B",
  maintenance: "#4A525B",
  brand: "#5B9CFF",
} as const;

export const theme = extendTheme({
  config,
  fonts: {
    heading: `"Instrument Sans", system-ui, sans-serif`,
    body: `"Instrument Sans", system-ui, sans-serif`,
  },
  colors: {
    carbon: {
      950: "#0F1214",
      900: "#171B1F",
      800: "#22282E",
      700: "#2C333A",
      600: "#3A424B",
    },
    ink: "#F4F6F7",
    brand: {
      50: "#E8F1FF",
      100: "#CFE1FF",
      200: "#A6C8FF",
      300: "#7FB1FF",
      400: "#5B9CFF",
      500: "#5B9CFF",
      600: "#3F7FE0",
      700: "#2D63B8",
      800: "#1E3A5F",
      900: "#142A45",
    },
    critical: { 500: tone.critical },
    warning: { 500: tone.warning },
    healthy: { 500: tone.healthy },
    info: { 500: tone.info },
  },
  semanticTokens: {
    colors: {
      "bg.page": "carbon.950",
      "bg.panel": "carbon.900",
      "bg.raised": "carbon.800",
      "border.subtle": "carbon.700",
      "text.primary": "ink",
      "text.muted": "#82888F",
    },
  },
  styles: {
    global: {
      "html, body": {
        bg: "carbon.950",
        color: "ink",
        fontFeatureSettings: '"tnum" 1',
      },
      "*:focus-visible": {
        outline: "2px solid",
        outlineColor: "brand.400",
        outlineOffset: "2px",
      },
      "@media (prefers-reduced-motion: reduce)": {
        "*": { animation: "none !important", transition: "none !important" },
      },
    },
  },
  components: {
    Button: {
      baseStyle: { fontWeight: 500, borderRadius: "md" },
      defaultProps: { colorScheme: "brand" },
    },
    Badge: {
      baseStyle: { textTransform: "none", fontWeight: 500, borderRadius: "sm" },
    },
    Heading: { baseStyle: { fontWeight: 500, letterSpacing: "-0.01em" } },
    Drawer: {
      baseStyle: { dialog: { bg: "carbon.900" } },
    },
    Tooltip: {
      baseStyle: { bg: "carbon.700", color: "ink", borderRadius: "md", px: 3, py: 2 },
    },
  },
});
