import { type Session, type User } from "@supabase/supabase-js";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../lib/supabaseClient";
import type { Role } from "./types";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  role: Role | null;
  isApproved: boolean;
  roleLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getOAuthRedirectUrl() {
  const url = new URL(window.location.href);
  if (
    url.hostname === "0.0.0.0" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1"
  ) {
    url.hostname = "localhost";
  }
  url.pathname = "/login";
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function fetchAccess(userId: string): Promise<{
  role: Role | null;
  isApproved: boolean;
} | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("role, is_approved")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  const role = (data as { role?: unknown } | null)?.role;
  if (
    role === "admin" ||
    role === "contacts_manager" ||
    role === "delivery_coordinator" ||
    role === "view_only"
  ) {
    return {
      role,
      isApproved: Boolean(
        (data as { is_approved?: unknown } | null)?.is_approved,
      ),
    };
  }

  return {
    role: null,
    isApproved: Boolean(
      (data as { is_approved?: unknown } | null)?.is_approved,
    ),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [role, setRole] = useState<Role | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  const refreshRole = async () => {
    if (!user) {
      setRole(null);
      setIsApproved(false);
      setRoleLoading(false);
      return;
    }
    setRoleLoading(true);
    try {
      await supabase.rpc("ensure_user_profile");
      const resolved = await fetchAccess(user.id);
      setRole(resolved?.role ?? "view_only");
      setIsApproved(resolved?.isApproved ?? false);
    } finally {
      setRoleLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setRoleLoading(Boolean(data.session?.user));
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    };

    void init();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setRoleLoading(Boolean(newSession?.user));
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      },
    );

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    void refreshRole();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getOAuthRedirectUrl(),
      },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      loading,
      role,
      isApproved,
      roleLoading,
      signInWithGoogle,
      signOut,
      refreshRole,
    }),
    [session, user, loading, role, isApproved, roleLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
