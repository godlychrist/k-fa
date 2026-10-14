import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const alreadyControlled = Boolean(navigator.serviceWorker.controller)
    let reloading = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (alreadyControlled && !reloading) {
        reloading = true
        location.reload()
      }
    })
    void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(error => console.error('No se pudo activar la consulta sin conexión.', error))
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
