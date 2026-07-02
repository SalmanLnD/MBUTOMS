import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { resetAllModalArtifacts } from './utils/modalCleanup.js';
import './styles/global.css';

resetAllModalArtifacts();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    resetAllModalArtifacts();
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
