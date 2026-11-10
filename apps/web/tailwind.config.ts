import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        don: {
          bg: '#0a0c10',
          card: '#12151c',
          cardHover: '#181c25',
          border: '#232a38',
          text: '#f8fafc',
          muted: '#94a3b8',
        },
        amber: {
          500: '#f59e0b',
          400: '#fbbf24',
          300: '#fcd34d',
          600: '#d97706',
        },
      },
    },
  },
  plugins: [],
};

export default config;
