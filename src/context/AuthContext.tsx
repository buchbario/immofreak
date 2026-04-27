import { createContext, useContext, useState, useCallback } from 'react';

interface AuthContextType {
  isLoggedIn: boolean;
  userName: string;
  userEmail: string;
  login: (name: string, email: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  userName: '',
  userEmail: '',
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('immofreak_auth') === 'true');
  const [userName, setUserName] = useState(() => localStorage.getItem('immofreak_profile_name') || '');
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('immofreak_profile_email') || '');

  const login = useCallback((name: string, email: string) => {
    localStorage.setItem('immofreak_auth', 'true');
    localStorage.setItem('immofreak_profile_name', name);
    localStorage.setItem('immofreak_profile_email', email);
    setIsLoggedIn(true);
    setUserName(name);
    setUserEmail(email);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('immofreak_auth');
    setIsLoggedIn(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isLoggedIn, userName, userEmail, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
