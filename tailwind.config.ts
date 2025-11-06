import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        autozap: {
          primary: '#3BBD4E',      // Verde Principal
          light: '#6EE07B',        // Verde Claro
          dark: '#2B903C',         // Verde Escuro
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



