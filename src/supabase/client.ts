import { createClient } from '@supabase/supabase-js';

// ─── Supabase Configuration ──────────────────────────────────────────
// Replace these with your actual Supabase project credentials
// from your Supabase dashboard: Settings → API

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://azwdrcjxjwkhwgquoine.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6d2RyY2p4andraHdncXVvaW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNTczOTAsImV4cCI6MjA5NjczMzM5MH0.mZaO9imBp3hYst9TuvN_IY-sT611S1xbTYRVZZJJEpk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// ─── Database Types ──────────────────────────────────────────────────

export interface Profile {
  id: string;
  username: string;
  rank: number;
  wins: number;
  losses: number;
  main_character: string | null;
  created_at: string;
}

export interface MatchRecord {
  id: string;
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  stage: string;
  duration_seconds: number;
  player1_damage: number;
  player2_damage: number;
  player1_character: string;
  player2_character: string;
  created_at: string;
}

export interface QueueEntry {
  id: string;
  player_id: string;
  username: string;
  rank: number;
  status: 'waiting' | 'matched' | 'cancelled';
  matched_with: string | null;
  webrtc_offer: string | null;
  webrtc_answer: string | null;
  created_at: string;
}
