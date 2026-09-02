import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ScenarioProvider } from './context/ScenarioContext.jsx'
import './index.css' // <--- THIS LINE MUST BE HERE

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ScenarioProvider>
      <App />
    </ScenarioProvider>
  </React.StrictMode>,
)
