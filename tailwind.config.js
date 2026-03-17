/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6366F1',
          light: '#818CF8',
          dark: '#4F46E5',
          50: '#EEF2FF',
          900: '#312E81',
        },
        surface: {
          light: '#FFFFFF',
          dark: '#18181B',
        },
        background: {
          light: '#F8FAFC',
          dark: '#09090B',
        },
      },
      fontFamily: {
        inter: ['Inter'],
        'inter-bold': ['Inter-Bold'],
        'inter-semibold': ['Inter-SemiBold'],
        mono: ['JetBrainsMono'],
      },
    },
  },
  plugins: [],
};
