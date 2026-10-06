/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)', card: 'var(--color-background)',
        foreground: 'var(--color-text)', muted: 'var(--color-surface)',
        'muted-foreground': 'var(--color-text-muted)', haze: 'var(--color-text-subtle)',
        line: 'var(--color-border)', 'line-strong': 'var(--color-border-strong)',
        primary: 'var(--color-primary)', accent: 'var(--color-accent)',
        blue: 'var(--color-accent)',
        toast: { success: 'var(--color-success)', info: 'var(--color-accent)', error: 'var(--color-danger)' }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['SFMono-Regular', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      }
    }
  },
  plugins: []
}
