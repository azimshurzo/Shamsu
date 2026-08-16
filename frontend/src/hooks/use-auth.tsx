"use client";
import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { api } from "@/lib/api";
import type { User } from "@/types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ id: "", name: "", email: "", role: "USER", subscriptionStatus: "FREE", apiCreationAttempts: 0, createdAt: "" }),
  register: async () => ({ id: "", name: "", email: "", role: "USER", subscriptionStatus: "FREE", apiCreationAttempts: 0, createdAt: "" }),
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const { user } = await api.auth.me();
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const login = async (email: string, password: string): Promise<User> => {
    const { user } = await api.auth.login({ email, password });
    setUser(user);
    return user;
  };

  const register = async (name: string, email: string, password: string): Promise<User> => {
    const { user } = await api.auth.register({ name, email, password });
    setUser(user);
    return user;
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
