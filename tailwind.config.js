/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F8FAFC',
        ink: { DEFAULT: '#172033', soft: '#475569', faint: '#64748B' },
        line: '#E2E8F0',
        accent: { DEFAULT: '#0F766E', light: '#CCFBF1', mid: '#14B8A6' },
        ask: { DEFAULT: '#2563EB', light: '#DBEAFE' },
        fsk: { DEFAULT: '#7C3AED', light: '#EDE9FE' },
        ok: { DEFAULT: '#15803D', light: '#DCFCE7' },
        warn: { DEFAULT: '#B45309', light: '#FEF3C7' },
        bad: { DEFAULT: '#B91C1C', light: '#FEE2E2' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'Cascadia Mono', 'Consolas', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(23,32,51,0.04), 0 1px 3px rgba(23,32,51,0.06)',
      },
    },
  },
  plugins: [],
};
