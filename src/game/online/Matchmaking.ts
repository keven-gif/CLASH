import { supabase, type Profile } from '@/supabase/client';
import { api } from '@/supabase/api';

export type MatchmakingState = 'idle' | 'searching' | 'found' | 'connecting' | 'ready' | 'failed';

export interface MatchFound {
  opponent: Profile;
  isHost: boolean;
}

export class MatchmakingManager {
  private state: MatchmakingState = 'idle';
  private myProfile: Profile | null = null;
  private sub: any = null;
  private onStateCb: ((s: MatchmakingState) => void) | null = null;
  private onMatch: ((m: MatchFound) => void) | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private done = false;

  async startSearch(profile: Profile): Promise<void> {
    this.myProfile = profile;
    this.done = false;
    this.setState('searching');
    await api.joinQueue(profile.id, profile.username, profile.rank);

    // Realtime subscription — fires when our row is updated to matched
    this.sub = supabase
      .channel('mq_' + profile.id)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'match_queue',
        filter: `player_id=eq.${profile.id}`,
      }, (p) => this.handleUpdate(p.new as any))
      .subscribe();

    // Polling fallback — find someone to match with
    this.pollTimer = setInterval(() => this.poll(), 2000);
  }

  private async poll(): Promise<void> {
    if (this.state !== 'searching' || this.done) return;
    const row = await api.findOpponent(this.myProfile!.id, this.myProfile!.rank);
    if (row) await this.becomeHost(row);
  }

  private async becomeHost(oppRow: any): Promise<void> {
    if (this.done || !this.myProfile) return;
    this.done = true;
    this.clearPoll();
    this.setState('found');

    // oppRow is a match_queue row — player_id is the auth UUID
    const oppPlayerId: string = oppRow.player_id;
    await api.markMatched(this.myProfile.id, oppPlayerId);

    // Fetch full profile so we have correct username/rank/etc.
    const oppProfile = await api.getProfile(oppPlayerId);
    if (!oppProfile) { this.setState('failed'); return; }

    this.onMatch?.({ opponent: oppProfile, isHost: true });
  }

  private async handleUpdate(entry: any): Promise<void> {
    // We (the client) were matched by the host
    if (entry.status === 'matched' && entry.matched_with && !this.done) {
      if (this.state !== 'searching') return;
      this.done = true;
      this.clearPoll();
      this.setState('found');

      const oppProfile = await api.getProfile(entry.matched_with);
      if (!oppProfile) { this.setState('failed'); return; }

      this.onMatch?.({ opponent: oppProfile, isHost: false });
    }
  }

  private clearPoll(): void {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
  }

  private setState(s: MatchmakingState): void { this.state = s; this.onStateCb?.(s); }

  getState(): MatchmakingState { return this.state; }
  onStateChange(cb: (s: MatchmakingState) => void): void { this.onStateCb = cb; }
  onMatchFound(cb: (m: MatchFound) => void): void { this.onMatch = cb; }

  async cancel(): Promise<void> {
    this.done = true;
    this.clearPoll();
    if (this.sub) { await supabase.removeChannel(this.sub); this.sub = null; }
    if (this.myProfile) await api.leaveQueue(this.myProfile.id);
    this.setState('idle');
  }

  destroy(): void { this.cancel(); }
}
