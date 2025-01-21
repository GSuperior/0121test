import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App' // 移除.tsx扩展名，让TypeScript自动解析
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)