import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { authRedirectTo, isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  commandPath,
  profileFromUser,
  type AccountType,
  type ReHomeProfile,
} from "@/lib/profile";

interface SignUpInput {
  name: string;
  email: string;
  password: string;
  accountType: AccountType;
}

interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: ReHomeProfile | null;
  error: string | null;
  signUp: (input: SignUpInput) => Promise<{ needsEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setAccountType: (accountType: AccountType) => Promise<void>;
  updateName: (name: string) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapAuthError(error: { message: string } | null | undefined): string {
  if (!error?.message) return "Something went wrong. Please try again.";
  const msg = error.message;
  if (/invalid login credentials/i.test(msg)) return "Email or password is incorrect.";
  if (/user already registered/i.test(msg)) return "An account with this email already exists.";
  if (/email not confirmed/i.test(msg)) return "Confirm your email before signing in.";
  if (/password/i.test(msg) && /least/i.test(msg)) return "Password must be at least 6 characters.";
  if (/rate limit/i.test(msg)) return "Too many attempts. Wait a moment and try again.";
  return msg;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (cancelled) return;
      if (sessionError) setError(mapAuthError(sessionError));
      setSession(data.session ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;
  const profile = useMemo(() => (user ? profileFromUser(user) : null), [user]);

  const signUp = useCallback(async (input: SignUpInput) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        emailRedirectTo: authRedirectTo(),
        data: {
          full_name: input.name.trim(),
          account_type: input.accountType,
        },
      },
    });
    if (signUpError) {
      const mapped = mapAuthError(signUpError);
      setError(mapped);
      throw new Error(mapped);
    }
    return { needsEmailConfirmation: Boolean(data.user) && !data.session };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      const mapped = mapAuthError(signInError);
      setError(mapped);
      throw new Error(mapped);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    setError(null);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      const mapped = mapAuthError(signOutError);
      setError(mapped);
      throw new Error(mapped);
    }
  }, []);

  const setAccountType = useCallback(async (accountType: AccountType) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({
      data: { account_type: accountType },
    });
    if (updateError) {
      const mapped = mapAuthError(updateError);
      setError(mapped);
      throw new Error(mapped);
    }
  }, []);

  const updateName = useCallback(async (name: string) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({
      data: { full_name: name.trim() },
    });
    if (updateError) {
      const mapped = mapAuthError(updateError);
      setError(mapped);
      throw new Error(mapped);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      session,
      user,
      profile,
      error,
      signUp,
      signIn,
      signOut,
      setAccountType,
      updateName,
      clearError: () => setError(null),
    }),
    [loading, session, user, profile, error, signUp, signIn, signOut, setAccountType, updateName]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useCommandHome() {
  const { profile } = useAuth();
  if (!profile?.accountType) return "/onboarding/account-type";
  return commandPath(profile.accountType);
}
