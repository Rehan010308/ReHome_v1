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
import { ensureOrganization, ensureProfile, fetchProfile, profileRowToApp, updateProfile } from "@/lib/data/profiles";

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
  refreshProfile: () => Promise<void>;
  signUp: (input: SignUpInput) => Promise<{ needsEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setAccountType: (accountType: AccountType) => Promise<void>;
  updateName: (name: string) => Promise<void>;
  updateProfileDetails: (patch: {
    name?: string;
    phone?: string;
    location?: string;
    bio?: string;
    city?: string;
    region?: string;
    country?: string;
  }) => Promise<void>;
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
  if (/schema cache/i.test(msg) || /could not find the table/i.test(msg)) {
    return "Database schema is not applied yet. Run supabase/migrations in the Supabase SQL editor.";
  }
  return msg;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [dbProfile, setDbProfile] = useState<ReHomeProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hydrateProfile = useCallback(async (current: User) => {
    const meta = profileFromUser(current);
    try {
      const row =
        (await fetchProfile(current.id)) ??
        (await ensureProfile({
          userId: current.id,
          email: current.email ?? meta.email,
          name: meta.name,
          accountType: meta.accountType,
        }));
      setDbProfile(profileRowToApp(row, current.email ?? meta.email));
    } catch (hydrateError) {
      // The profiles row could not be read — most often because the migrations
      // have not been applied. Fall back to auth metadata so the session still
      // works, but make it loud: silently substituting hid a missing schema.
      console.error("[ReHome] profile hydration failed:", hydrateError);
      setDbProfile(meta);
      setError(mapAuthError(hydrateError as { message: string }));
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (cancelled) return;
      if (sessionError) setError(mapAuthError(sessionError));
      setSession(data.session ?? null);
      if (data.session?.user) await hydrateProfile(data.session.user);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next?.user) {
        void hydrateProfile(next.user).finally(() => setLoading(false));
      } else {
        setDbProfile(null);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [hydrateProfile]);

  const user = session?.user ?? null;
  // Memoised: profileFromUser() returns a fresh object on every call, so an
  // unmemoised fallback changes identity each render and re-triggers every
  // useAsync loader keyed on the profile.
  const profile = useMemo<ReHomeProfile | null>(
    () => dbProfile ?? (user ? profileFromUser(user) : null),
    [dbProfile, user]
  );

  const refreshProfile = useCallback(async () => {
    if (user) await hydrateProfile(user);
  }, [hydrateProfile, user]);

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
    setDbProfile(null);
  }, []);

  const setAccountType = useCallback(async (accountType: AccountType) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    const current = supabase.auth.getUser ? (await supabase.auth.getUser()).data.user : null;
    if (!current) throw new Error("You need to be signed in.");
    setError(null);
    try {
      const meta = profileFromUser(current);
      const row = await ensureProfile({
        userId: current.id,
        email: current.email ?? "",
        name: meta.name,
        accountType,
      });
      if (!row.account_type) {
        await updateProfile(current.id, { account_type: accountType });
      }
      if (accountType === "organization") {
        await ensureOrganization({
          userId: current.id,
          name: row.display_name,
          email: current.email ?? "",
        });
      }
      await supabase.auth.updateUser({ data: { account_type: accountType } });
      await hydrateProfile(current);
    } catch (updateError) {
      const mapped = mapAuthError(updateError as { message: string });
      setError(mapped);
      throw new Error(mapped);
    }
  }, [hydrateProfile]);

  const updateName = useCallback(async (name: string) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    const current = (await supabase.auth.getUser()).data.user;
    if (!current) throw new Error("You need to be signed in.");
    setError(null);
    try {
      await updateProfile(current.id, { display_name: name.trim() });
      await supabase.auth.updateUser({ data: { full_name: name.trim() } });
      await hydrateProfile(current);
    } catch (updateError) {
      const mapped = mapAuthError(updateError as { message: string });
      setError(mapped);
      throw new Error(mapped);
    }
  }, [hydrateProfile]);

  const updateProfileDetails = useCallback(
    async (patch: {
      name?: string;
      phone?: string;
      location?: string;
      bio?: string;
      city?: string;
      region?: string;
      country?: string;
    }) => {
      if (!supabase) throw new Error("Supabase is not configured.");
      const current = (await supabase.auth.getUser()).data.user;
      if (!current) throw new Error("You need to be signed in.");
      setError(null);
      try {
        await updateProfile(current.id, {
          display_name: patch.name?.trim(),
          phone: patch.phone,
          location: patch.location,
          bio: patch.bio,
          city: patch.city,
          region: patch.region,
          country: patch.country,
        });
        if (patch.name) {
          await supabase.auth.updateUser({ data: { full_name: patch.name.trim() } });
        }
        await hydrateProfile(current);
      } catch (updateError) {
        const mapped = mapAuthError(updateError as { message: string });
        setError(mapped);
        throw new Error(mapped);
      }
    },
    [hydrateProfile]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      session,
      user,
      profile,
      error,
      refreshProfile,
      signUp,
      signIn,
      signOut,
      setAccountType,
      updateName,
      updateProfileDetails,
      clearError: () => setError(null),
    }),
    [
      loading,
      session,
      user,
      profile,
      error,
      refreshProfile,
      signUp,
      signIn,
      signOut,
      setAccountType,
      updateName,
      updateProfileDetails,
    ]
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
