import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // ── NexGen Enterprise Design System ─────────────────────────────────
        // Surface scale
        surface:                    'var(--color-surface)',
        'surface-dim':              'var(--color-surface-dim)',
        'surface-bright':           'var(--color-surface-bright)',
        'surface-container-lowest': 'var(--color-surface-container-lowest)',
        'surface-container-low':    'var(--color-surface-container-low)',
        'surface-container':        'var(--color-surface-container)',
        'surface-container-high':   'var(--color-surface-container-high)',
        'surface-container-highest':'var(--color-surface-container-highest)',

        // On-surface
        'on-surface':               'var(--color-on-surface)',
        'on-surface-variant':       'var(--color-on-surface-variant)',
        'inverse-surface':          'var(--color-inverse-surface)',
        'inverse-on-surface':       'var(--color-inverse-on-surface)',

        // Outline
        outline:                    'var(--color-outline)',
        'outline-variant':          'var(--color-outline-variant)',

        // Primary
        primary:                    'var(--color-primary)',
        'on-primary':               'var(--color-on-primary)',
        'primary-container':        'var(--color-primary-container)',
        'on-primary-container':     'var(--color-on-primary-container)',
        'inverse-primary':          'var(--color-inverse-primary)',
        'primary-fixed':            'var(--color-primary-fixed)',
        'primary-fixed-dim':        'var(--color-primary-fixed-dim)',
        'on-primary-fixed':         'var(--color-on-primary-fixed)',
        'on-primary-fixed-variant': 'var(--color-on-primary-fixed-variant)',
        'surface-tint':             'var(--color-surface-tint)',

        // Secondary
        secondary:                  'var(--color-secondary)',
        'on-secondary':             'var(--color-on-secondary)',
        'secondary-container':      'var(--color-secondary-container)',
        'on-secondary-container':   'var(--color-on-secondary-container)',
        'secondary-fixed':          'var(--color-secondary-fixed)',
        'secondary-fixed-dim':      'var(--color-secondary-fixed-dim)',
        'on-secondary-fixed':       'var(--color-on-secondary-fixed)',
        'on-secondary-fixed-variant':'var(--color-on-secondary-fixed-variant)',

        // Tertiary
        tertiary:                   'var(--color-tertiary)',
        'on-tertiary':              'var(--color-on-tertiary)',
        'tertiary-container':       'var(--color-tertiary-container)',
        'on-tertiary-container':    'var(--color-on-tertiary-container)',
        'tertiary-fixed':           'var(--color-tertiary-fixed)',
        'tertiary-fixed-dim':       'var(--color-tertiary-fixed-dim)',
        'on-tertiary-fixed':        'var(--color-on-tertiary-fixed)',
        'on-tertiary-fixed-variant':'var(--color-on-tertiary-fixed-variant)',

        // Semantic
        error:                      'var(--color-error)',
        'on-error':                 'var(--color-on-error)',
        'error-container':          'var(--color-error-container)',
        'on-error-container':       'var(--color-on-error-container)',
        'success-emerald':          'var(--color-success-emerald)',

        background:                 'var(--color-background)',
        'on-background':            'var(--color-on-background)',
        'surface-variant':          'var(--color-surface-variant)',

        // Legacy aliases
        brutal: {
          ink:      'var(--color-brutal-ink)',
          yellow:   'var(--color-brutal-yellow)',
          red:      'var(--color-brutal-red)',
          blue:     'var(--color-brutal-blue)',
          cream:    'var(--color-brutal-cream)',
          surface:  'var(--color-brutal-surface)',
          'surface-lo': 'var(--color-brutal-surface-lo)',
          'surface-hi': 'var(--color-brutal-surface-hi)',
          'surface-dim': 'var(--color-brutal-surface-dim)',
          white:    'var(--color-brutal-white)',
        },
        brand: {
          DEFAULT: 'var(--color-brand)',
          light:   'var(--color-brand-light)',
        },
        accent: 'var(--color-accent)',
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
        // Legacy brutalist shadows
        brutal:      'var(--shadow-brutal)',
        'brutal-lg': 'var(--shadow-brutal-lg)',
        'brutal-sm': 'var(--shadow-brutal-sm)',
        'brutal-yellow': 'var(--shadow-brutal-yellow)',

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
