import type { Profile } from '@/supabase/client';
import { api } from '@/supabase/api';

export type MatchmakingState = 'idle' | 'searching' | 'found' | 'connecting' | 'ready' | 'failed';

export interface MatchFound {
  opponents: Profile[];    // 1–3 opponents
  myPlayerIndex: number;   // 0 = host, 1–3 = guests
  roomId: string;          // host's player_id
  isHost: boolean;
  opponent: Profile;       // first opponent (legacy compat)
}

const ACCUMULATION_MS = 30_000; // wait up to 30s to fill room to 4
const MAX_ROOM_SIZE = 4;

export class MatchmakingManager {
  private state: MatchmakingState = 'idle';
  private myProfile: Profile | null = null;
  private onStateCb: ((s: MatchmakingState) => void) | null = null;
  private onMatch: ((m: MatchFound) => void) | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private searchStart = 0;
  private done = false;

  async startSearch(profile: Profile): Promise<void> {
    this.myProfile = profile;
    this.done = false;
    this.searchStart = Date.now();
    this.setState('searching');
    await api.joinQueue(profile.id, profile.username, profile.rank);
    await api.heartbeat(profile.id);
    this.heartbeatTimer = setInterval(() => api.heartbeat(profile.id), 5000);
    this.pollTimer = setInterval(() => this.poll(), 2000);
    this.poll();
  }

  private async poll(): Promise<void> {
    if (this.state !== 'searching' || this.done || !this.myProfile) return;
    const myId = this.myProfile.id;

    // ── Step 1: Check if I'm already in a room ───────────────────────
    const hostRow = await api.findRoomForMe(myId);
    if (hostRow) {
      this.done = true;
      this.clearPoll();
      this.setState('found');

      const hostProfile = await api.getProfile(hostRow.player_id);
      if (!hostProfile) { this.setState('failed'); return; }

      const guestIds = (hostRow.matched_with as string ?? '').split(',').filter(Boolean);
      const myIndexInGuests = guestIds.indexOf(myId);
      const myPlayerIndex = myIndexInGuests >= 0 ? myIndexInGuests + 1 : 1;

      const otherGuestIds = guestIds.filter(id => id !== myId);
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

    // ── Step 2: Find all active waiting players ───────────────────────
    const otherRows = await api.findOpponents(myId, MAX_ROOM_SIZE - 1, []);
    const otherIds = otherRows.map((r: any) => r.player_id as string);

    if (otherIds.length === 0) return; // alone in queue, keep waiting

    // ── Step 3: Deterministic host election — smallest UUID wins ─────
    // This eliminates the dual-host race: only one player in any group
    // will ever call markMatchedRoom, because the election is deterministic.
    const allIds = [myId, ...otherIds].sort();
    const amHost = allIds[0] === myId;

    if (!amHost) {
      // I'm not the smallest ID — just wait for the host to pick me up via findRoomForMe
      return;
    }

    // ── Step 4: I am host — accumulate guests up to room size ────────
    const guestIds = otherIds.slice(0, MAX_ROOM_SIZE - 1); // take up to 3

    // Claim guests immediately so no other player can steal them
    await api.markMatchedRoom(myId, guestIds);

    const elapsed = Date.now() - this.searchStart;
    const roomFull = guestIds.length >= MAX_ROOM_SIZE - 1;
    const timedOut = elapsed >= ACCUMULATION_MS;

    if (roomFull || timedOut) {
      this.done = true;
      this.clearPoll();
      this.setState('found');

      const guestProfiles = (await Promise.all(
        guestIds.map(id => api.getProfile(id))
      )).filter(Boolean) as Profile[];

      if (guestProfiles.length === 0) { this.setState('failed'); return; }

      this.onMatch?.({
        opponents: guestProfiles,
        opponent: guestProfiles[0],
        myPlayerIndex: 0,
        roomId: myId,
        isHost: true,
      });
    }
    // else: room not full and not timed out yet — keep polling every 2s
    // next poll will see more players if they join, and update matched_with
  }

  private clearPoll(): void {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
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
