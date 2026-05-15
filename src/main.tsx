import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { router } from './router'
import { AppModeProvider } from './context/AppModeContext'
import { AuthProvider } from './context/AuthContext'
import { TourProvider } from './context/TourContext'
import { LocaleProvider } from './context/LocaleContext'

// Seeding wird NICHT mehr automatisch beim App-Boot ausgeführt.
// Stattdessen entscheidet die Login-Seite:
//   - „Demo starten"-Button → `seedDemoData()`  (frische Demo-Daten)
//   - Normaler Login        → `clearAllData()` (leere Arbeitsumgebung
//                                                — Vorbereitung für die DB)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      <AuthProvider>
        <AppModeProvider>
          <TourProvider>
            <RouterProvider router={router} />
          </TourProvider>
        </AppModeProvider>
      </AuthProvider>
    </LocaleProvider>
  </StrictMode>,
)
