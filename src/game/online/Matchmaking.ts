import type { Profile } from '@/supabase/client';
import { api } from '@/supabase/api';

export type MatchmakingState = 'idle' | 'searching' | 'found' | 'connecting' | 'ready' | 'failed';

export interface MatchFound {
  opponent: Profile;
  isHost: boolean;
}

export class MatchmakingManager {
  private state: MatchmakingState = 'idle';
  private myProfile: Profile | null = null;
  private onStateCb: ((s: MatchmakingState) => void) | null = null;
  private onMatch: ((m: MatchFound) => void) | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private done = false;

  async startSearch(profile: Profile): Promise<void> {
    this.myProfile = profile;
    this.done = false;
    this.setState('searching');
    await api.joinQueue(profile.id, profile.username, profile.rank);
    // Poll every 2s — checks both host and client scenarios
    this.pollTimer = setInterval(() => this.poll(), 2000);
    // Run immediately instead of waiting 2s for first tick
    this.poll();
  }

  private async poll(): Promise<void> {
    if (this.state !== 'searching' || this.done || !this.myProfile) return;

    // 1. Check if our own row was matched by someone else (we are the client)
    const myRow = await api.getQueueEntry(this.myProfile.id);
    if (myRow?.status === 'matched' && myRow.matched_with) {
      this.done = true;
      this.clearPoll();
      this.setState('found');
      const oppProfile = await api.getProfile(myRow.matched_with);
      if (!oppProfile) { this.setState('failed'); return; }
      this.onMatch?.({ opponent: oppProfile, isHost: false });
      return;
    }

    // 2. Try to find a waiting opponent and become host
    const oppRow = await api.findOpponent(this.myProfile.id, this.myProfile.rank);
    if (oppRow) {
      this.done = true;
      this.clearPoll();
      this.setState('found');
      const oppPlayerId: string = oppRow.player_id;
      await api.markMatched(this.myProfile.id, oppPlayerId);
      const oppProfile = await api.getProfile(oppPlayerId);
      if (!oppProfile) { this.setState('failed'); return; }
      this.onMatch?.({ opponent: oppProfile, isHost: true });
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
    if (this.myProfile) await api.leaveQueue(this.myProfile.id);
    this.setState('idle');
  }

  destroy(): void { this.cancel(); }
}
