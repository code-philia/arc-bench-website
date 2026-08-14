import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api } from "../lib/api";
import type { UserSummary } from "../lib/types";

type AuthContextValue = {
  user: UserSummary | null;
  isLoading: boolean;
  login: (payload: { email: string; password: string }) => Promise<UserSummary>;
  loginWithHackathon: (accessToken: string) => Promise<UserSummary>;
  register: (payload: { email: string; username: string; password: string; internal_beta_code?: string | null }) => Promise<UserSummary>;
  updateProfile: (payload: { github_email?: string | null; github_username?: string | null }) => Promise<UserSummary>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await api.getCurrentUser();
      setUser(response.user);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (payload: { email: string; password: string }) => {
    const response = await api.login(payload);
    setUser(response.user);
    return response.user;
  }, []);

  const loginWithHackathon = useCallback(async (accessToken: string) => {
    const response = await api.exchangeHackathonSession(accessToken);
    setUser(response.user);
    return response.user;
  }, []);

  const register = useCallback(async (payload: { email: string; username: string; password: string; internal_beta_code?: string | null }) => {
    const response = await api.register(payload);
    setUser(response.user);
    return response.user;
  }, []);

  const updateProfile = useCallback(async (payload: { github_email?: string | null; github_username?: string | null }) => {
    const response = await api.updateProfile(payload);
    setUser(response.user);
    return response.user;
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, loginWithHackathon, register, updateProfile, logout, refresh }),
    [user, isLoading, login, loginWithHackathon, register, updateProfile, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
