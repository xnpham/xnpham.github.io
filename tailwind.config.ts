import type { Config } from 'tailwindcss';

export default {
  content: [
  './src/app/**/*.{js,ts,jsx,tsx}',
  './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      maxWidth: {
        '5xl': '64rem',
      },
    },
  },
  plugins: [],
} satisfies Config;