import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-toastify/dist/ReactToastify.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { LoginModalProvider } from './context/LoginModalContext.jsx';
import { resetAllModalArtifacts } from './utils/modalCleanup.js';
import './styles/global.css';
import './styles/theme.css';
import './styles/modal.css';

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
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
