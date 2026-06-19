import { supabase } from './client';
import type { Profile, MatchRecord } from './client';

export const api = {
  // ─── Profiles ────────────────────────────────────────────────────────
  async getProfile(userId: string): Promise<Profile | null> {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    return (data as Profile) ?? null;
  },

  async updateProfile(userId: string, updates: Partial<Profile>) {
    return supabase.from('profiles').update(updates).eq('id', userId);
  },

  // ─── Leaderboard ─────────────────────────────────────────────────────
  async getLeaderboard(limit = 50): Promise<Profile[]> {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('rank', { ascending: false })
      .order('wins', { ascending: false })
      .limit(limit);
    return (data as Profile[]) ?? [];
  },

  // ─── Match History ───────────────────────────────────────────────────
  async getMatchHistory(userId: string, limit = 20): Promise<MatchRecord[]> {
    const { data } = await supabase
      .from('matches')
      .select('*')
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data as MatchRecord[]) ?? [];
  },

  async recordMatch(match: Omit<MatchRecord, 'id' | 'created_at'>) {
    return supabase.from('matches').insert(match);
  },

  // ─── Queue ───────────────────────────────────────────────────────────
  async joinQueue(playerId: string, username: string, rank: number) {
    return supabase.from('match_queue').upsert({
      player_id: playerId, username, rank,
      status: 'waiting', matched_with: null,
      webrtc_offer: new Date().toISOString(), // initial heartbeat
      webrtc_answer: null,
    }, { onConflict: 'player_id' });
  },

  async leaveQueue(playerId: string) {
    return supabase.from('match_queue').delete().eq('player_id', playerId);
  },

  async findOpponent(playerId: string, rank: number, range = 500) {
    const { data } = await supabase
      .from('match_queue')
      .select('*')
      .eq('status', 'waiting')
      .neq('player_id', playerId)
      .gte('rank', rank - range)
      .lte('rank', rank + range)
      .order('created_at', { ascending: true })
      .limit(1);
    return data?.[0] ?? null;
  },

  async markMatched(playerId: string, opponentId: string) {
    // Only update own row — avoids RLS cross-user update restrictions
    await supabase.from('match_queue').update({ status: 'matched', matched_with: opponentId }).eq('player_id', playerId);
  },

  async findWhoMatchedMe(myId: string) {
    const { data } = await supabase
      .from('match_queue')
      .select('*')
      .eq('status', 'matched')
      .eq('matched_with', myId)
      .limit(1);
    return data?.[0] ?? null;
  },

  // ─── Multi-player room matchmaking ───────────────────────────────────
  async findOpponents(myId: string, max: number = 3, exclude: string[] = []): Promise<any[]> {
    // Only return players who sent a heartbeat in the last 20 seconds
    const cutoff = new Date(Date.now() - 20_000).toISOString();
    const { data } = await supabase
      .from('match_queue')
      .select('*')
      .eq('status', 'waiting')
      .neq('player_id', myId)
      .gte('webrtc_offer', cutoff)  // heartbeat filter
      .order('created_at', { ascending: true })
      .limit(max + exclude.length);
    const rows = (data ?? []) as any[];
    return rows.filter(r => !exclude.includes(r.player_id)).slice(0, max);
  },

  // Heartbeat: call every 5s while searching to prove the player is still active
  async heartbeat(playerId: string): Promise<void> {
    await supabase
      .from('match_queue')
      .update({ webrtc_offer: new Date().toISOString() })
      .eq('player_id', playerId);
  },

  async markMatchedRoom(myId: string, guestIds: string[]): Promise<void> {
    await supabase
      .from('match_queue')
      .update({ status: 'matched', matched_with: guestIds.join(',') })
      .eq('player_id', myId);
  },

  async findRoomForMe(myId: string): Promise<any | null> {
    const { data } = await supabase
      .from('match_queue')
      .select('*')
      .eq('status', 'matched')
      .ilike('matched_with', `%${myId}%`)
      .limit(1);
    return data?.[0] ?? null;
  },

  async submitAnswer(playerId: string, answer: string) {
    return supabase.from('match_queue').update({ webrtc_answer: answer }).eq('player_id', playerId);
  },

  async getQueueEntry(playerId: string) {
    const { data } = await supabase.from('match_queue').select('*').eq('player_id', playerId).single();
    return data;
  },

  // ─── Stats (direct updates — no RPC functions needed) ────────────────
  async incrementWins(userId: string) {
    const { data } = await supabase.from('profiles').select('wins, rank').eq('id', userId).single();
    if (!data) return null;
    return supabase.from('profiles').update({
      wins: (data.wins || 0) + 1,
      rank: (data.rank || 0) + 10,
    }).eq('id', userId);
  },

  async incrementLosses(userId: string) {
    const { data } = await supabase.from('profiles').select('losses, rank').eq('id', userId).single();
    if (!data) return null;
    return supabase.from('profiles').update({
      losses: (data.losses || 0) + 1,
      rank: Math.max(0, (data.rank || 0) - 5),
    }).eq('id', userId);
  },
};
