/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
        },
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'border-primary': 'var(--border-primary)',
        'border-subtle': 'var(--border-subtle)',
        accent: {
          DEFAULT: 'var(--accent-primary)',
          hover: 'var(--accent-hover)',
        },
        status: {
          success: 'var(--status-success)',
          warning: 'var(--status-warning)',
          danger: 'var(--status-error)',
          info: 'var(--status-info)',
        },
        sidebar: {
          DEFAULT: 'var(--sidebar-bg)',
          text: 'var(--sidebar-text)',
          muted: 'var(--sidebar-text-muted)',
          hover: 'var(--sidebar-hover)',
          active: 'var(--sidebar-active)',
        },
      },
      spacing: {
        'sidebar-expanded': '240px',
        'sidebar-collapsed': '64px',
      },
      fontSize: {
        'dense-xs': ['0.625rem', { lineHeight: '0.875rem' }],
        'dense-sm': ['0.75rem', { lineHeight: '1rem' }],
      },
      transitionProperty: {
        'width': 'width',
        'spacing': 'margin, padding',
      },
    },
  },
  plugins: [],
}
