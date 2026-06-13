import { createClient } from '@supabase/supabase-js';

// ─── Supabase Configuration ──────────────────────────────────────────
// Replace these with your actual Supabase project credentials
// from your Supabase dashboard: Settings → API

const SUPABASE_URL = 'https://azwdrcjxjwkhwgquoine.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1qiCC8AX4QGrsw4IFhxEiw_xcdGeUSY';

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
