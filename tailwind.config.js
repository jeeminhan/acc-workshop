/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        paper: {
          50: '#f7f3ea',
          100: '#ece6db',
          200: '#e0d8c8',
          300: '#c8bda8',
        },
        ink: {
          900: '#2a251f',
          700: '#4a3f30',
          500: '#6a5a48',
        },
        teal: {
          700: '#0d6e6e',
        },
      },
    },
  },
  plugins: [],
};
