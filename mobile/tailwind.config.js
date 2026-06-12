/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1498ff',
          hover: '#55c7ff',
          strong: '#0077ff',
          subtle: 'rgba(20,152,255,0.10)',
          border: 'rgba(20,152,255,0.28)',
        },
        cb: {
          page: '#030406',
          surface: '#090b10',
          elevated: '#111318',
          hover: '#191c23',
          border: '#222630',
          'border-strong': '#343946',
          primary: '#f8fbff',
          secondary: '#c8cfda',
          muted: '#858c9b',
          disabled: '#4d5360',
        },
        accent: {
          violet: '#8b5cf6',
          pink: '#f43f8c',
          lime: '#84cc16',
          orange: '#fb923c',
        },
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
      },
      fontFamily: {
        sans: ['System'],
        mono: ['monospace'],
      },
    },
  },
  plugins: [],
};
