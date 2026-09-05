import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const saved = localStorage.getItem('erp_theme');
if (saved) document.documentElement.setAttribute('data-theme', saved);

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
