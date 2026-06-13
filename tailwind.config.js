/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // CLASH Design Tokens
        void: '#050507',
        'bg-dark': '#0A0A0F',
        'bg-panel': '#111118',
        'bg-panel-hover': '#1A1A24',
        'bg-elevated': '#1E1E2A',
        'border-subtle': '#2A2A3A',
        'border-active': '#3D3D55',
        'text-primary': '#F0F0F5',
        'text-secondary': '#8A8AA3',
        'text-muted': '#555570',
        // Character Accents
        'accent-crimson': '#E81D2D',
        'accent-cyan': '#00E5D4',
        'accent-ice': '#4DA6FF',
        'accent-green': '#39FF14',
        // HUD Colors
        'hp-full': '#00E5D4',
        'hp-mid': '#FFB800',
        'hp-high': '#E81D2D',
        'hp-extreme': '#FF0044',
        'shield-blue': '#4DA6FF',
        'shield-break': '#E81D2D',
        // shadcn compatibility
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        rajdhani: ['Rajdhani', 'sans-serif'],
      },
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
        '2xl': '48px',
        '3xl': '64px',
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        'glow-cyan': '0 0 40px rgba(0,229,212,0.25)',
        'glow-crimson': '0 0 40px rgba(232,29,45,0.25)',
        'glow-ice': '0 0 40px rgba(77,166,255,0.25)',
        'glow-green': '0 0 40px rgba(57,255,20,0.25)',
        'btn-primary': '0 4px 16px rgba(240,240,245,0.15)',
        'btn-primary-lg': '0 6px 24px rgba(240,240,245,0.12)',
        'btn-danger': '0 4px 16px rgba(232,29,45,0.3)',
      },
      transitionTimingFunction: {
        'game': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'snap': 'cubic-bezier(0.68, -0.55, 0.27, 1.55)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'hit': 'cubic-bezier(0.1, 0.9, 0.2, 1)',
      },
      transitionDuration: {
        'instant': '50ms',
        'fast': '150ms',
        'normal': '300ms',
        'slow': '500ms',
        'dramatic': '800ms',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        "logo-pulse": {
          "0%, 100%": { textShadow: "0 0 40px rgba(0,229,212,0.4), 0 0 80px rgba(0,229,212,0.2)" },
          "50%": { textShadow: "0 0 40px rgba(0,229,212,0.7), 0 0 80px rgba(0,229,212,0.35)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
        "pulse-glow": "pulse-glow 2s ease-smooth infinite",
        "logo-pulse": "logo-pulse 3s ease-smooth infinite",
      },
      letterSpacing: {
        'logo': '0.15em',
        'screen-title': '0.08em',
        'section': '0.05em',
        'subtitle': '0.3em',
        'tap': '0.2em',
        'button': '0.04em',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
