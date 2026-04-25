import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#050914',
          900: '#0a0f1e',
          800: '#0f1629',
          700: '#161e35',
          600: '#1e2840',
        },
        apex: {
          bg: '#0a0a0a',
          'bg-deep': '#050507',
          card: '#18181b',
          elevated: '#1a1a1f',
          primary: '#2e62ff',
          'primary-bright': '#4f7dff',
          secondary: '#b7c4ff',
          violet: '#a78bfa',
          emerald: '#34d399',
          error: '#f87171',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"Space Grotesk"', 'monospace'],
      },
      maxWidth: {
        apex: '1440px',
      },
      animation: {
        'gradient-shift': 'gradient-shift 8s ease infinite',
        'fade-up': 'fade-up 0.5s ease forwards',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
