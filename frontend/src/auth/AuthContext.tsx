import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  getCurrentUser,
  type AuthUser,
} from "../api/auth";

type AuthStatus = "loading" | "ready" | "error";

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  error: string | null;
  refresh: () => Promise<AuthUser | null>;
  setUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setStatus("ready");
      return currentUser;
    } catch (cause) {
      setStatus("error");
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to verify your session",
      );
      throw cause;
    }
  }, []);

  const updateUser = useCallback((nextUser: AuthUser | null) => {
    setUser(nextUser);
    setStatus("ready");
    setError(null);
  }, []);

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  const value = useMemo(
    () => ({ user, status, error, refresh, setUser: updateUser }),
    [user, status, error, refresh, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
