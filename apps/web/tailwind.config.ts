import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Neo-Brutalist palette
        brutal: {
          ink:      '#1a1a1a',
          yellow:   '#ffa23a',
          red:      '#e63b2e',
          blue:     '#0055ff',
          cream:    '#f5f0e8',
          surface:  '#eee9e0',
          'surface-lo': '#f2ede5',
          'surface-hi': '#e8e3da',
          'surface-dim': '#d6d1c9',
          white:    '#ffffff',
        },
        // Legacy brand tokens (kept for compatibility)
        brand: {
          DEFAULT: '#1A3C5E',
          light:   '#2E86C1',
        },
        accent: '#27AE60',
      },
      fontFamily: {
        sans:    ['Inter', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
        label:   ['Space Grotesk', 'sans-serif'],
      },
      borderRadius: {
        none:    '0px',
        DEFAULT: '0px',
        sm:      '0px',
        md:      '0px',
        lg:      '0px',
        xl:      '0px',
        '2xl':   '0px',
        '3xl':   '0px',
        full:    '9999px',
      },
      boxShadow: {
        brutal:      '4px 4px 0px 0px #1a1a1a',
        'brutal-lg': '8px 8px 0px 0px #1a1a1a',
        'brutal-sm': '2px 2px 0px 0px #1a1a1a',
        'brutal-yellow': '4px 4px 0px 0px #ffa23a',
      },
    },
  },
  plugins: [],
};

export default config;
