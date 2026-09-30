// Development-only entry: Vite's production build includes only frontend/index.html.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/context/AuthContext.jsx';
import { ThemeProvider } from '../../src/context/ThemeContext.jsx';
import { LoginModalProvider, useLoginModal } from '../../src/context/LoginModalContext.jsx';
import { notifySessionExpired, resetSessionExpiredState } from '../../src/utils/sessionManager.js';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../../src/styles/global.css';
import '../../src/styles/workspace-theme.css';
import '../../src/styles/workspace.css';
import '../../src/styles/layout.css';
import '../../src/styles/modal.css';
import '../../src/styles/styled-select.css';

const root = createRoot(document.getElementById('root'));
function LoginTrigger() {
  const { openLoginModal } = useLoginModal();
  React.useEffect(() => { openLoginModal(); }, [openLoginModal]);
  return null;
}
function render(child) {
  root.render(<BrowserRouter><AuthProvider><ThemeProvider><LoginModalProvider>{child}</LoginModalProvider></ThemeProvider></AuthProvider></BrowserRouter>);
}
window.modalAudit = {
  close() { render(null); },
  async mount(name, props = {}) {
    render(null);
    resetSessionExpiredState();
    await new Promise(resolve => setTimeout(resolve, 25));
    const { default: Component } = await import(/* @vite-ignore */ `/src/components/${name}.jsx`);
    const callbacks = { onClose: () => render(null), onComplete: () => {}, onSaved: () => {}, onChanged: () => {}, onLinked: () => {}, onSave: () => {}, onCreated: () => {}, onImported: () => {}, onConfirm: () => {}, onManageTopics: () => {}, onManageResource: () => {} };
    render(<>{name === 'LoginModal' && <LoginTrigger />}<Component show {...callbacks} {...props} /></>);
    if (name === 'SessionExpiredModal') setTimeout(() => notifySessionExpired({ code: 'APP_VERSION_UPDATED' }), 200);
  },
};
render(null);
