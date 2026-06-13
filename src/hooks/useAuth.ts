import { useState, useEffect, useCallback } from 'react';
import { supabase, type Profile } from '@/supabase/client';

export function useAuth() {
  const [user, setUser] = useState<Profile | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // ── Fetch or create profile for a user ────────────────────────────
  const fetchProfile = useCallback(async (userId: string) => {
    console.log('[useAuth] fetchProfile for', userId);

    // Try to fetch existing profile
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data && !error) {
      console.log('[useAuth] profile found:', data.username);
      setUser(data as Profile);
      setLoading(false);
      return;
    }

    console.log('[useAuth] no profile found, creating...');

    // Profile doesn't exist — create it
    const { data: sessionData } = await supabase.auth.getSession();
    const email = sessionData.session?.user?.email || '';
    const metaUsername = sessionData.session?.user?.user_metadata?.username;
    const username = metaUsername || email.split('@')[0] || 'fighter';

    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        username,
        rank: 0,
        wins: 0,
        losses: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[useAuth] profile insert failed:', insertError.message);
      setUser(null);
    } else if (newProfile) {
      console.log('[useAuth] profile created:', newProfile.username);
      setUser(newProfile as Profile);
    }

    setLoading(false);
  }, []);

  // ── Listen for auth state changes ─────────────────────────────────
  useEffect(() => {
    console.log('[useAuth] useEffect running');

    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[useAuth] getSession result:', session ? 'has session' : 'no session');
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch((err) => {
      console.error('[useAuth] getSession failed:', err);
      setLoading(false);
    });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[useAuth] onAuthStateChange:', event, session?.user?.email);
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
    if (data.user) {
      // Create profile directly (trigger may not fire)
      await supabase.from('profiles').insert({
        id: data.user.id,
        username,
        rank: 0,
        wins: 0,
        losses: 0,
      });
    }
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
