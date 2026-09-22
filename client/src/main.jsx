import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import AppContextProvider from './context/AppContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { queryClient } from './api/queryClient.js'

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AppContextProvider>
          <App />
        </AppContextProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </ErrorBoundary>,
)
