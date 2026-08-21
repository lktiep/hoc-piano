import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './site.css'
import './styles.css'
import './home.css'
import './library.css'
import './roadmap.css'

const el = document.getElementById('root')
if (!el) throw new Error('Khong tim thay #root')
createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
