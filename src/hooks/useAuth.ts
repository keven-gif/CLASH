import { useState, useEffect, useCallback } from 'react';
import { supabase, type Profile } from '@/supabase/client';

export function useAuth() {
  const [user, setUser] = useState<Profile | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // ── Fetch or create profile for a user ────────────────────────────
  const fetchProfile = useCallback(async (userId: string) => {
    // Try to fetch existing profile
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data && !error) {
      setUser(data as Profile);
      setLoading(false);
      return;
    }

    // Profile doesn't exist yet — upsert so DB trigger / signUp races are harmless
    const { data: sessionData } = await supabase.auth.getSession();
    const email = sessionData.session?.user?.email || '';
    const metaUsername = sessionData.session?.user?.user_metadata?.username;
    const username = metaUsername || email.split('@')[0] || 'fighter';

    const { data: newProfile, error: upsertError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        username,
        rank: 0,
        wins: 0,
        losses: 0,
      }, { onConflict: 'id', ignoreDuplicates: false })
      .select()
      .single();

    if (upsertError) {
      // On duplicate-key or any error, try a plain fetch — the row likely exists
      const { data: existing } = await supabase
        .from('profiles').select('*').eq('id', userId).single();
      if (existing) {
        setUser(existing as Profile);
      }
      // Never setUser(null) here — that triggers a redirect loop
    } else if (newProfile) {
      setUser(newProfile as Profile);
    }

    setLoading(false);
  }, []);

  // ── Listen for auth state changes ─────────────────────────────────
  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch(() => {
      setLoading(false);
    });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // ── Auth actions ──────────────────────────────────────────────────
  const signUp = useCallback(async (email: string, password: string, username: string) => {
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { username } }
    });
    if (error) throw error;
    // Don't insert profile here — the DB trigger fires on auth.users insert
    // and onAuthStateChange → fetchProfile will upsert if needed.
    // A manual insert here races with both and causes duplicate-key errors.
    return data;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // After sign in, the onAuthStateChange listener will fire
    // and fetchProfile will be called automatically
    return data;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user) return;
    await supabase.from('profiles').update(updates).eq('id', user.id);
    setUser({ ...user, ...updates });
  }, [user]);

  return { user, session, loading, signUp, signIn, signOut, updateProfile };
}
