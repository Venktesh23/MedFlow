import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, responseData } from "@/services/api";

type AuthUser = {
  _id: string;
  name: string;
  email: string;
  clinicName?: string;
  clinicHoursStart?: number;
  clinicHoursEnd?: number;
  specialty?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    clinicName?: string;
    specialty?: string;
  }) => Promise<void>;
  updateProfile: (payload: {
    name?: string;
    clinicName?: string;
    clinicHoursStart?: number;
    clinicHoursEnd?: number;
    specialty?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => localStorage.getItem("medflow_token"));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem("medflow_user");
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      localStorage.removeItem("medflow_user");
      return null;
    }
  });

  useEffect(() => {
    if (user || !token) return;
    api.get("/auth/me").then((res) => {
      const data = responseData<{ user: AuthUser }>(res);
      setUser(data.user);
    }).catch(() => {});
  }, []);

  const saveSession = (nextToken: string, nextUser: AuthUser) => {
    localStorage.setItem("medflow_token", nextToken);
    localStorage.setItem("medflow_user", JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      login: async (email, password) => {
        const response = await api.post("/auth/login", { email, password });
        const data = responseData<{ token: string; user: AuthUser }>(response);
        saveSession(data.token, data.user);
      },
      register: async (payload) => {
        const response = await api.post("/auth/register", payload);
        const data = responseData<{ token: string; user: AuthUser }>(response);
        saveSession(data.token, data.user);
      },
      updateProfile: async (payload) => {
        const response = await api.put("/settings/profile", payload);
        const data = responseData<{ user: AuthUser }>(response);
        localStorage.setItem("medflow_user", JSON.stringify(data.user));
        setUser(data.user);
      },
      logout: async () => {
        try {
          await api.post("/auth/logout");
        } catch {
          // ignore — clear local state regardless
        }
        localStorage.removeItem("medflow_token");
        localStorage.removeItem("medflow_user");
        setToken(null);
        setUser(null);
      },
    }),
    [token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
