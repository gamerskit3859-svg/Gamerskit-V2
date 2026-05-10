import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#ffffff",
        "background-soft": "#f5f5f7",
        "background-elevated": "rgba(255, 255, 255, 0.72)",
        "background-glass": "rgba(255, 255, 255, 0.6)",
        "background-glass-dark": "rgba(0, 0, 0, 0.5)",
        foreground: "#1d1d1f",
        "foreground-soft": "#6e6e73",
        "foreground-muted": "#86868b",
        line: "rgba(0, 0, 0, 0.08)",
        "line-strong": "rgba(0, 0, 0, 0.16)",
        accent: "#0071e3",
      },
      borderRadius: {
        xs: "10px",
        sm: "10px",
        md: "16px",
        lg: "22px",
        xl: "32px",
        full: "999px",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(0, 0, 0, 0.04)",
        sm: "0 1px 2px rgba(0, 0, 0, 0.04)",
        md: "0 8px 24px rgba(0, 0, 0, 0.06)",
        lg: "0 24px 64px rgba(0, 0, 0, 0.10)",
        glass: "0 18px 50px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.85), inset 0 -1px 0 rgba(255, 255, 255, 0.35)",
        "glass-scrolled": "0 20px 60px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
        "icon-btn": "0 6px 18px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.75)",
        "icon-btn-hover": "0 10px 28px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Inter"',
          '"Segoe UI"',
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      fontSize: {
        eyebrow: ["12px", { lineHeight: "1.2", letterSpacing: "0.18em", fontWeight: "500" }],
        "display-2": ["clamp(36px, 5vw, 64px)", { lineHeight: "1.06", letterSpacing: "-0.035em", fontWeight: "600" }],
        "display-1": ["clamp(48px, 8vw, 96px)", { lineHeight: "1.04", letterSpacing: "-0.045em", fontWeight: "600" }],
      },
      backdropBlur: {
        glass: "22px",
        "glass-strong": "28px",
        "glass-mobile": "34px",
        "icon-btn": "16px",
      },
      keyframes: {
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "fade-up": {
          from: {
            opacity: "0",
            transform: "translateY(8px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
      },
      animation: {
        marquee: "marquee 40s linear infinite",
        "fade-up": "fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
      letterSpacing: {
        tight: "-0.01em",
        display: "-0.02em",
      },
      gridAutoColumns: {
        "13": "minmax(0, 13rem)",
      },
    },
  },
  plugins: [
    // Custom glass effect plugin
    function ({ addComponents, theme, addUtilities }) {
      addComponents({
        ".glass": {
          "@apply bg-background-glass backdrop-blur-glass saturate-150 border border-line rounded-lg": {},
          "-webkit-backdrop-filter": "saturate(180%) blur(22px)",
        },
        ".glass-dark": {
          "@apply backdrop-blur-glass border border-white/10 rounded-lg text-white": {},
          "background": "rgba(20, 20, 22, 0.55)",
          "-webkit-backdrop-filter": "saturate(180%) blur(22px)",
        },
        ".glass-strong": {
          "@apply bg-white/84 backdrop-blur-glass-strong border border-line rounded-lg": {},
          "-webkit-backdrop-filter": "saturate(180%) blur(28px)",
        },
        ".hairline-b": {
          "@apply border-b border-line": {},
        },
        ".hairline-t": {
          "@apply border-t border-line": {},
        },
        ".hairline-r": {
          "@apply border-r border-line": {},
        },
        ".card-soft": {
          "@apply bg-background-soft border border-line rounded-md": {},
        },
        ".sr-only": {
          "@apply absolute w-1 h-1 p-0 -m-1 overflow-hidden clip-rect-0 whitespace-nowrap border-0": {},
        },
      });

      addUtilities({
        ".saturate-150": {
          filter: "saturate(150%)",
        },
        ".saturate-180": {
          filter: "saturate(180%)",
        },
        ".saturate-190": {
          filter: "saturate(190%)",
        },
        ".scrollbar-hide": {
          "-ms-overflow-style": "none",
          "scrollbar-width": "none",
          "&::-webkit-scrollbar": {
            display: "none",
          },
        },
      });
    },
  ],
};

export default config;
