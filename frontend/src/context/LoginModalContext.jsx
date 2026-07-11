import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const LoginModalContext = createContext(null);

export const LoginModalProvider = ({ children }) => {
  const [state, setState] = useState({
    open: false,
    message: '',
    redirectTo: null,
  });

  const openLoginModal = useCallback(({ message = '', redirectTo = null } = {}) => {
    setState({
      open: true,
      message,
      redirectTo,
    });
  }, []);

  const closeLoginModal = useCallback(() => {
    setState({
      open: false,
      message: '',
      redirectTo: null,
    });
  }, []);

  const value = useMemo(
    () => ({
      loginModalOpen: state.open,
      loginModalMessage: state.message,
      loginRedirectTo: state.redirectTo,
      openLoginModal,
      closeLoginModal,
    }),
    [state, openLoginModal, closeLoginModal]
  );

  return (
    <LoginModalContext.Provider value={value}>
      {children}
    </LoginModalContext.Provider>
  );
};

export const useLoginModal = () => {
  const context = useContext(LoginModalContext);
  if (!context) {
    throw new Error('useLoginModal must be used within LoginModalProvider');
  }
  return context;
};
