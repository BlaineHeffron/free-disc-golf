import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { isNative, restore } from './persist'

// Saved data must be back in localStorage before the app first reads it.
restore().finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
)

// The Android app bundles its files, so only the website needs the offline service worker.
if ('serviceWorker' in navigator && import.meta.env.PROD && !isNative) {
  navigator.serviceWorker.register('./sw.js')
}
