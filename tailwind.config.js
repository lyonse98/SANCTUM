/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        forge: {
          bg: '#EFEAE2',
          'bg-elevated': '#F5F1EA',
          card: '#FBF8F3',
          'card-hover': '#FFFFFF',
          steel: '#DCD3C5',
          'steel-light': '#C6BCAB',
          iron: '#B3A793',
          'iron-light': '#9E9179',
          ember: '#C2410C',
          'ember-bright': '#EA580C',
          'ember-dark': '#9A3412',
          flame: '#EA580C',
          ash: '#6B6459',
          'ash-light': '#4A443C',
          text: '#3A352E',
          'text-bright': '#1B1815',
          'text-muted': '#635C51',
          'text-dim': '#756D61',
          gold: '#A16207',
          'gold-light': '#CA8A04',
          moss: '#4A6B4A',
          'moss-light': '#5A7A5A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Oswald', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'slide-up': 'slideUp 0.3s ease-out forwards',
        'pulse-slow': 'pulseSlow 4s ease-in-out infinite',
        'ember-glow': 'emberGlow 2s ease-in-out infinite',
        'forge-flicker': 'forgeFlicker 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSlow: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.8' },
          '50%': { transform: 'scale(1.15)', opacity: '1' },
        },
        emberGlow: {
          '0%, 100%': { opacity: '0.6', filter: 'blur(8px)' },
          '50%': { opacity: '1', filter: 'blur(12px)' },
        },
        forgeFlicker: {
          '0%, 100%': { opacity: '0.8' },
          '33%': { opacity: '1' },
          '66%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
};
