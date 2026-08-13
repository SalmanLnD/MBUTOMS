import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-toastify/dist/ReactToastify.css';
import App from './App.jsx';
import { initTheme } from './utils/themeManager.js';
import { AuthProvider } from './context/AuthContext.jsx';
import { LoginModalProvider } from './context/LoginModalContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { purgeModalOverlaysOnBoot, resetAllModalArtifacts } from './utils/modalCleanup.js';
import './styles/global.css';
import './styles/theme.css';
import './styles/clay-bento.css';
import './styles/filters.css';
import './styles/modal.css';
import './styles/styled-select.css';

initTheme();

purgeModalOverlaysOnBoot();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    // Body lock only — do not tear out React portal nodes during HMR dispose.
    resetAllModalArtifacts();
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <LoginModalProvider>
            <App />
            <ToastContainer
              position="top-right"
              autoClose={3000}
              hideProgressBar={false}
              newestOnTop
              closeOnClick
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="colored"
            />
          </LoginModalProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
