import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // ── NexGen Enterprise Design System ─────────────────────────────────
        // Surface scale
        surface:                    '#faf8ff',
        'surface-dim':              '#d2d9f4',
        'surface-bright':           '#faf8ff',
        'surface-container-lowest': '#ffffff',
        'surface-container-low':    '#f2f3ff',
        'surface-container':        '#eaedff',
        'surface-container-high':   '#e1e7ff',
        'surface-container-highest':'#dae2fc',

        // On-surface
        'on-surface':               '#131b2e',
        'on-surface-variant':       '#59413a',
        'inverse-surface':          '#283044',
        'inverse-on-surface':       '#eef0ff',

        // Outline
        outline:                    '#8d7169',
        'outline-variant':          '#e2bfb5',

        // Primary — burnt orange
        primary:                    '#812200',
        'on-primary':               '#ffffff',
        'primary-container':        '#aa3000',
        'on-primary-container':     '#ffc8b9',
        'inverse-primary':          '#ffb59f',
        'primary-fixed':            '#ffdbd0',
        'primary-fixed-dim':        '#ffb59f',
        'on-primary-fixed':         '#3a0a00',
        'on-primary-fixed-variant': '#852400',
        'surface-tint':             '#ad3202',

        // Secondary — professional teal
        secondary:                  '#01677d',
        'on-secondary':             '#ffffff',
        'secondary-container':      '#9ae5fe',
        'on-secondary-container':   '#03687e',
        'secondary-fixed':          '#b3ebff',
        'secondary-fixed-dim':      '#86d1ea',
        'on-secondary-fixed':       '#001f27',
        'on-secondary-fixed-variant':'#004e5f',

        // Tertiary — amber/gold
        tertiary:                   '#5b4000',
        'on-tertiary':              '#ffffff',
        'tertiary-container':       '#795600',
        'on-tertiary-container':    '#ffce74',
        'tertiary-fixed':           '#ffdea7',
        'tertiary-fixed-dim':       '#efbf67',
        'on-tertiary-fixed':        '#271900',
        'on-tertiary-fixed-variant':'#5e4200',

        // Semantic
        error:                      '#ba1a1a',
        'on-error':                 '#ffffff',
        'error-container':          '#ffdad6',
        'on-error-container':       '#93000a',
        'success-emerald':          '#059669',

        background:                 '#faf8ff',
        'on-background':            '#131b2e',
        'surface-variant':          '#dae2fc',

        // Legacy aliases kept so old class references don't break
        brand: {
          DEFAULT: '#812200',
          light:   '#aa3000',
        },
        accent: '#059669',
      },

      fontFamily: {
        sans:    ['Inter', 'sans-serif'],
        display: ['Inter', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
        label:   ['Inter', 'sans-serif'],
      },

      borderRadius: {
        none:    '0px',
        sm:      '0.125rem',
        DEFAULT: '0.25rem',
        md:      '0.375rem',
        lg:      '0.5rem',
        xl:      '0.75rem',
        '2xl':   '1rem',
        '3xl':   '1.5rem',
        full:    '9999px',
      },

      boxShadow: {
        // Tonal layering — no harsh offset shadows
        sm:      '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        DEFAULT: '0 2px 8px 0 rgb(0 0 0 / 0.08), 0 1px 3px -1px rgb(0 0 0 / 0.04)',
        md:      '0 4px 12px 0 rgb(0 0 0 / 0.10), 0 2px 6px -2px rgb(0 0 0 / 0.06)',
        lg:      '0 8px 24px 0 rgb(0 0 0 / 0.12), 0 4px 8px -4px rgb(0 0 0 / 0.06)',
        xl:      '0 16px 40px 0 rgb(0 0 0 / 0.14)',
        // Primary glow for focused/featured elements
        'primary-glow': '0 0 0 3px rgba(170,48,0,0.18)',
        'secondary-glow': '0 0 0 3px rgba(1,103,125,0.18)',
        none:    'none',
      },

      spacing: {
        sidebar: '260px',
      },
    },
  },
  plugins: [],
};

export default config;
