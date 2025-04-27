import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import reportWebVitals from './reportWebVitals'

import '@fontsource/readex-pro/300.css'
import '@fontsource/readex-pro/400.css'
import '@fontsource/readex-pro/500.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'

const rootElement = document.getElementById('root')
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <App />
  )
} else {
  console.error('No se encontró el elemento raíz')
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
