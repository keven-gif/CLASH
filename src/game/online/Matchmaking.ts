import type { Profile } from '@/supabase/client';
import { api } from '@/supabase/api';

export type MatchmakingState = 'idle' | 'searching' | 'found' | 'connecting' | 'ready' | 'failed';

export interface MatchFound {
  opponents: Profile[];    // 1–3 opponents (total players = opponents.length + 1)
  myPlayerIndex: number;   // 0 = host, 1–3 = guests
  roomId: string;          // host's player_id, used as channel name
  isHost: boolean;
  // Legacy compat
  opponent: Profile;       // first opponent (same as opponents[0])
}

const SEARCH_TIMEOUT_MS = 30_000; // start with 1+ opponent after 30s

export class MatchmakingManager {
  private state: MatchmakingState = 'idle';
  private myProfile: Profile | null = null;
  private onStateCb: ((s: MatchmakingState) => void) | null = null;
  private onMatch: ((m: MatchFound) => void) | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private searchStart = 0;
  private done = false;

  async startSearch(profile: Profile): Promise<void> {
    this.myProfile = profile;
    this.done = false;
    this.searchStart = Date.now();
    this.setState('searching');
    await api.joinQueue(profile.id, profile.username, profile.rank);
    this.pollTimer = setInterval(() => this.poll(), 2000);
    this.poll();
  }

  private async poll(): Promise<void> {
    if (this.state !== 'searching' || this.done || !this.myProfile) return;

    // 1. Am I already invited to a room by a host?
    const hostRow = await api.findRoomForMe(this.myProfile.id);
    if (hostRow) {
      this.done = true;
      this.clearPoll();
      this.setState('found');
      const hostProfile = await api.getProfile(hostRow.player_id);
      if (!hostProfile) { this.setState('failed'); return; }

      // Determine my index: I'm position (indexOf in comma-separated list) + 1
      const guestIds: string[] = (hostRow.matched_with as string).split(',');
      const myIndexInGuests = guestIds.indexOf(this.myProfile.id);
      const myPlayerIndex = myIndexInGuests + 1; // host is 0, guests are 1+

      // Fetch all other guest profiles
      const otherGuestIds = guestIds.filter(id => id !== this.myProfile!.id);
      const otherGuests = await Promise.all(otherGuestIds.map(id => api.getProfile(id)));
      const validOthers = otherGuests.filter(Boolean) as Profile[];

      // opponents = host + any other guests before me in the list
      const opponents = [hostProfile, ...validOthers];
      this.onMatch?.({
        opponents,
        opponent: hostProfile,
        myPlayerIndex,
        roomId: hostRow.player_id,
        isHost: false,
      });
      return;
    }

    // 2. Try to collect opponents and become host
    const elapsed = Date.now() - this.searchStart;
    const maxOpponents = elapsed >= SEARCH_TIMEOUT_MS ? 1 : 3; // after timeout accept just 1
    const oppRows = await api.findOpponents(this.myProfile.id, maxOpponents);

    if (oppRows.length > 0) {
      this.done = true;
      this.clearPoll();
      this.setState('found');

      const guestIds = oppRows.map((r: any) => r.player_id as string);
      await api.markMatchedRoom(this.myProfile.id, guestIds);

      const guestProfiles = await Promise.all(guestIds.map(id => api.getProfile(id)));
      const opponents = guestProfiles.filter(Boolean) as Profile[];
      if (opponents.length === 0) { this.setState('failed'); return; }

      this.onMatch?.({
        opponents,
        opponent: opponents[0],
        myPlayerIndex: 0,
        roomId: this.myProfile.id,
        isHost: true,
      });
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
