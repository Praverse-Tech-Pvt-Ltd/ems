import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // ── Page surfaces ──────────────────────────────────────────
        background:                   '#faf8ff',
        surface:                      '#faf8ff',
        'surface-dim':                '#d2d9f4',
        'surface-bright':             '#faf8ff',
        'surface-container-lowest':   '#ffffff',
        'surface-container-low':      '#f2f3ff',
        'surface-container':          '#eaedff',
        'surface-container-high':     '#e1e7ff',
        'surface-container-highest':  '#dae2fc',
        'surface-variant':            '#dae2fc',
        'surface-tint':               '#aa3000',
        // ── Content ────────────────────────────────────────────────
        'on-surface':                 '#131b2e',
        'on-surface-variant':         '#59413a',
        'on-background':              '#131b2e',
        'inverse-surface':            '#283044',
        'inverse-on-surface':         '#eef0ff',
        // ── Borders ────────────────────────────────────────────────
        outline:                      '#8d7169',
        'outline-variant':            '#e2bfb5',
        // ── Card ───────────────────────────────────────────────────
        card:                         '#ffffff',
        'card-border':                '#e2bfb5',
        // ── Brand primary (burnt orange) ───────────────────────────
        primary:                      '#aa3000',
        'primary-dark':               '#812200',
        'on-primary':                 '#ffffff',
        'primary-container':          '#ffdbd0',
        'primary-fixed':              '#ffdbd0',
        'primary-fixed-dim':          '#ffb59f',
        'on-primary-container':       '#3a0a00',
        'on-primary-fixed':           '#3a0a00',
        'on-primary-fixed-variant':   '#852400',
        'inverse-primary':            '#ffb59f',
        // ── Brand secondary (teal) ─────────────────────────────────
        secondary:                    '#01677d',
        'on-secondary':               '#ffffff',
        'secondary-container':        '#9ae5fe',
        'on-secondary-container':     '#03687e',
        'secondary-dim':              '#86d1ea',
        'secondary-fixed':            '#b3ebff',
        'secondary-fixed-dim':        '#86d1ea',
        'on-secondary-fixed':         '#001f27',
        'on-secondary-fixed-variant': '#004d5e',
        // ── Tertiary (amber) ───────────────────────────────────────
        tertiary:                     '#795600',
        'on-tertiary':                '#ffffff',
        'tertiary-container':         '#ffdeab',
        'on-tertiary-container':      '#ffce74',
        'tertiary-fixed':             '#ffdeab',
        'tertiary-fixed-dim':         '#f0bc48',
        'on-tertiary-fixed':          '#261a00',
        'on-tertiary-fixed-variant':  '#5b4000',
        // ── Semantic ───────────────────────────────────────────────
        error:                        '#ba1a1a',
        'on-error':                   '#ffffff',
        'error-container':            '#ffdad6',
        'on-error-container':         '#93000a',
        success:                      '#059669',
      },
      borderRadius: {
        DEFAULT: '2px',
        sm:   '4px',
        md:   '6px',
        lg:   '8px',
        xl:   '12px',
        '2xl':'16px',
        full: '9999px',
      },
      spacing: {
        gutter: '24px',
        lg: '40px',
        sm: '16px',
        md: '24px',
        xl: '64px',
        xs: '8px',
        base: '4px',
        'margin-mobile': '16px',
        'margin-desktop': '32px',
      },
      fontFamily: {
        'body-lg': ['Inter'],
        'body-sm': ['Inter'],
        'headline-lg': ['Inter'],
        'display-lg': ['Inter'],
        'headline-lg-mobile': ['Inter'],
        'title-md': ['Inter'],
        'label-caps': ['JetBrains Mono'],
      },
      fontSize: {
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'display-lg': ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg-mobile': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'title-md': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'label-caps': ['12px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '500' }],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ],
};

export default config;
