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
        festive: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        royal: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#1e1b4b',
        },
        celebration: {
          rose: '#e11d48',
          gold: '#f59e0b',
          emerald: '#10b981',
          teal: '#0d9488',
          purple: '#9333ea',
        }
      },
      boxShadow: {
        'festive-glow': '0 0 25px -5px rgba(245, 158, 11, 0.25)',
        'royal-glow': '0 0 25px -5px rgba(99, 102, 241, 0.25)',
      }
    },
  },
  plugins: [],
};
export default config;
