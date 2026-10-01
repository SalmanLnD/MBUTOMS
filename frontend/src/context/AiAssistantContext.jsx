import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { canUseAiAssistant } from '../utils/aiAssistantAccess.js';
import AiAssistant from '../components/AiAssistant.jsx';

const AiAssistantContext = createContext(null);
export const useAiAssistant = () => useContext(AiAssistantContext);

const AssistantSession = ({ children, enabled }) => {
  const [open, setOpen] = useState(false);
  const launcher = useRef(null);
  const openAssistant = useCallback((event) => {
    launcher.current = event?.currentTarget || document.activeElement;
    setOpen(true);
  }, []);
  const closeAssistant = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => {
      if (launcher.current?.isConnected) launcher.current.focus();
      else document.querySelector('[aria-label="Open all pages"], [aria-label="Open TOMS Assistant"]')?.focus();
    });
  }, []);
  return (
    <AiAssistantContext.Provider value={{ enabled, open, openAssistant, closeAssistant }}>
      {children}
      {enabled && <AiAssistant open={open} onClose={closeAssistant} />}
    </AiAssistantContext.Provider>
  );
};

export const AiAssistantProvider = ({ children }) => {
  const { user } = useAuth();
  // Switching accounts, role, or trainer view destroys all private chat state.
  const sessionKey = `${user?._id}:${user?.role}:${user?.trainer}:${user?.impersonating}:${user?.mustResetPassword}`;
  return <AssistantSession key={sessionKey} enabled={canUseAiAssistant(user)}>{children}</AssistantSession>;
};
