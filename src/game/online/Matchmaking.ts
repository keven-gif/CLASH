import type { Profile } from '@/supabase/client';
import { api } from '@/supabase/api';

export type MatchmakingState = 'idle' | 'searching' | 'found' | 'connecting' | 'ready' | 'failed';

export interface MatchFound {
  opponents: Profile[];    // 1–3 opponents (total players = opponents.length + 1)
  myPlayerIndex: number;   // 0 = host, 1–3 = guests
  roomId: string;          // host's player_id, used as channel name
  isHost: boolean;
  opponent: Profile;       // first opponent (legacy compat)
}

const ACCUMULATION_MS = 30_000; // wait up to 30s to fill room
const MAX_ROOM_SIZE = 4;

export class MatchmakingManager {
  private state: MatchmakingState = 'idle';
  private myProfile: Profile | null = null;
  private onStateCb: ((s: MatchmakingState) => void) | null = null;
  private onMatch: ((m: MatchFound) => void) | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private searchStart = 0;
  private done = false;

  // Accumulated guest IDs while this player is acting as host
  private collectedGuestIds: string[] = [];

  async startSearch(profile: Profile): Promise<void> {
    this.myProfile = profile;
    this.done = false;
    this.collectedGuestIds = [];
    this.searchStart = Date.now();
    this.setState('searching');
    await api.joinQueue(profile.id, profile.username, profile.rank);
    this.pollTimer = setInterval(() => this.poll(), 2000);
    this.poll();
  }

  private async poll(): Promise<void> {
    if (this.state !== 'searching' || this.done || !this.myProfile) return;

    // ── Guest path: check if a host already picked me up ─────────────
    const hostRow = await api.findRoomForMe(this.myProfile.id);
    if (hostRow) {
      this.done = true;
      this.clearPoll();
      this.setState('found');

      const hostProfile = await api.getProfile(hostRow.player_id);
      if (!hostProfile) { this.setState('failed'); return; }

      // My index is my position in the comma-separated guest list + 1 (host is 0)
      const guestIds: string[] = (hostRow.matched_with as string).split(',').filter(Boolean);
      const myIndexInGuests = guestIds.indexOf(this.myProfile.id);
      const myPlayerIndex = myIndexInGuests >= 0 ? myIndexInGuests + 1 : 1;

      // Fetch profiles of other guests in the same room
      const otherGuestIds = guestIds.filter(id => id !== this.myProfile!.id);
      const otherGuests = (await Promise.all(otherGuestIds.map(id => api.getProfile(id)))).filter(Boolean) as Profile[];

      this.onMatch?.({
        opponents: [hostProfile, ...otherGuests],
        opponent: hostProfile,
        myPlayerIndex,
        roomId: hostRow.player_id,
        isHost: false,
      });
      return;
    }

    // ── Host path: accumulate opponents over time ─────────────────────
    const needed = (MAX_ROOM_SIZE - 1) - this.collectedGuestIds.length;
    if (needed > 0) {
      // Find waiting players we haven't collected yet
      const rows = await api.findOpponents(this.myProfile.id, needed, this.collectedGuestIds);
      for (const row of rows) {
        if (!this.collectedGuestIds.includes(row.player_id)) {
          this.collectedGuestIds.push(row.player_id);
        }
      }
    }

    const elapsed = Date.now() - this.searchStart;
    const roomFull = this.collectedGuestIds.length >= MAX_ROOM_SIZE - 1;
    const timedOut = elapsed >= ACCUMULATION_MS;

    if (this.collectedGuestIds.length === 0) return; // still no one, keep waiting

    if (roomFull || timedOut) {
      // Room is ready — mark ourselves as host and fire
      this.done = true;
      this.clearPoll();
      this.setState('found');

      await api.markMatchedRoom(this.myProfile.id, this.collectedGuestIds);

      const guestProfiles = (await Promise.all(
        this.collectedGuestIds.map(id => api.getProfile(id))
      )).filter(Boolean) as Profile[];

      if (guestProfiles.length === 0) { this.setState('failed'); return; }

      this.onMatch?.({
        opponents: guestProfiles,
        opponent: guestProfiles[0],
        myPlayerIndex: 0,
        roomId: this.myProfile.id,
        isHost: true,
      });
    }
    // else: keep polling every 2s until room fills or timeout
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
