import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('k-theme') === 'dark' || (!localStorage.getItem('k-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches) }
    catch { return false }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    try { localStorage.setItem('k-theme', dark ? 'dark' : 'light') } catch { /* The theme still works without storage. */ }
  }, [dark])
  return <button className="secondary theme-toggle" aria-pressed={dark} onClick={() => setDark(!dark)}>{dark ? '☀ Modo claro' : '☾ Modo oscuro'}</button>
}
