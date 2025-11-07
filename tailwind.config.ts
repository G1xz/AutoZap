import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', 'sans-serif'],
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        autozap: {
          primary: '#5227FF',      // Roxo Principal
          light: '#7C5AFF',        // Roxo Claro
          dark: '#3D1FCC',         // Roxo Escuro
          gray: {
            dark: '#212121',       // Cinza Escuro
            medium: '#616161',     // Cinza Médio
          },
          white: '#FFFFFF',        // Branco
        },
      },
    },
  },
  plugins: [],
}
export default config



