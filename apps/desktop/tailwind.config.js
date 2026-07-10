/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        background: '#f6f8fa',
        card: '#fafbfc',
        foreground: '#1d2127',
        muted: '#eef1f4',
        'muted-foreground': '#73787f',
        haze: '#969ba2',
        line: '#dcdfe3',
        'line-strong': '#c4c9ce',
        blue: '#0e66c8'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['SFMono-Regular', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      }
    }
  },
  plugins: []
}
