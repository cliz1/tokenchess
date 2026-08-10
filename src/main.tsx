import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import "./assets/chessground.jade.css"; // board theme presets
import "./assets/chessground.classic.css";
import "./assets/chessground.walnut.css";
import "./assets/chessground.ice.css";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
