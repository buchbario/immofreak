import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { router } from './router'
import { seedIfEmpty } from './lib/seedData'
import { AppModeProvider } from './context/AppModeContext'
import { AuthProvider } from './context/AuthContext'
import { TourProvider } from './context/TourContext'
import { LocaleProvider } from './context/LocaleContext'

seedIfEmpty()

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
