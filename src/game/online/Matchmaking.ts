import { supabase, type Profile } from '@/supabase/client';
import { api } from '@/supabase/api';
import { NetworkManager } from './NetworkManager';

export type MatchmakingState = 'idle' | 'searching' | 'found' | 'connecting' | 'ready' | 'failed';

export interface MatchFound {
  opponent: Profile;
  isHost: boolean;
}

export class MatchmakingManager {
  private state: MatchmakingState = 'idle';
  private nm = new NetworkManager();
  private myProfile: Profile | null = null;
  private sub: any = null;
  private onState: ((s: MatchmakingState) => void) | null = null;
  private onMatch: ((m: MatchFound) => void) | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  async startSearch(profile: Profile): Promise<void> {
    this.myProfile = profile;
    this.setState('searching');
    await api.joinQueue(profile.id, profile.username, profile.rank);

    // Realtime subscription for queue updates
    this.sub = supabase
      .channel('mq_' + profile.id)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'match_queue',
        filter: `player_id=eq.${profile.id}`,
      }, (p) => this.handleUpdate(p.new as any))
      .subscribe();

    // Polling fallback
    this.pollTimer = setInterval(() => this.poll(profile), 2000);
  }

  private async poll(profile: Profile): Promise<void> {
    if (this.state !== 'searching') return;
    const opp = await api.findOpponent(profile.id, profile.rank);
    if (opp) await this.becomeHost(opp as Profile);
  }

  private async becomeHost(opp: Profile): Promise<void> {
    if (!this.myProfile) return;
    this.setState('connecting');
    this.clearPoll();
    const offer = await this.nm.createOffer();
    await api.markMatched(this.myProfile.id, opp.id, offer);
    this.setState('found');
    this.onMatch?.({ opponent: opp, isHost: true });
  }

  private async becomeClient(offer: string, opp: Profile): Promise<void> {
    this.setState('connecting');
    this.clearPoll();
    const answer = await this.nm.acceptOffer(offer);
    if (this.myProfile) await api.submitAnswer(this.myProfile.id, answer);
    this.setState('found');
    this.onMatch?.({ opponent: opp, isHost: false });
  }

  async hostAcceptAnswer(answer: string): Promise<void> {
    await this.nm.acceptAnswer(answer);
    this.setState('ready');
  }

  private async handleUpdate(entry: any): Promise<void> {
    if (entry.status === 'matched' && entry.matched_with && !entry.webrtc_offer) {
      setTimeout(async () => {
        const fresh = await api.getQueueEntry(entry.player_id);
        if (fresh?.webrtc_offer) {
          const { data } = await supabase.from('profiles').select('*').eq('id', entry.matched_with).single();
          if (data) await this.becomeClient(fresh.webrtc_offer, data as Profile);
        }
      }, 500);
    }
    if (entry.status === 'matched' && entry.webrtc_answer) {
      await this.nm.acceptAnswer(entry.webrtc_answer);
      this.setState('ready');
    }
  }

  private clearPoll(): void {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
  }

  private setState(s: MatchmakingState): void { this.state = s; this.onState?.(s); }

  getNetworkManager(): NetworkManager { return this.nm; }
  getState(): MatchmakingState { return this.state; }
  onStateChange(cb: (s: MatchmakingState) => void): void { this.onState = cb; }
  onMatchFound(cb: (m: MatchFound) => void): void { this.onMatch = cb; }

  async cancel(): Promise<void> {
    this.clearPoll();
    if (this.sub) { await supabase.removeChannel(this.sub); this.sub = null; }
    if (this.myProfile) await api.leaveQueue(this.myProfile.id);
    this.nm.disconnect();
    this.setState('idle');
  }

  destroy(): void { this.cancel(); }
}
