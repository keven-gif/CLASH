import { supabase } from '@/supabase/client';

export interface RemoteInput {
  joystick: { x: number; y: number };
  attack: boolean;
  special: boolean;
  jump: boolean;
  shield: boolean;
  grab: boolean;
  attackPressed: boolean;
  specialPressed: boolean;
  jumpPressed: boolean;
  shieldPressed: boolean;
  grabPressed: boolean;
}

type EventCallback = (data: any) => void;

export class RealtimeChannel {
  private channel: ReturnType<typeof supabase.channel>;
  private myId: string;
  private onInputCb: ((inp: RemoteInput) => void) | null = null;
  private latestInput: RemoteInput | null = null;
  private eventListeners = new Map<string, EventCallback[]>();
  private presenceCb: ((state: Record<string, any[]>) => void) | null = null;
  private subscribed = false;

  constructor(matchId: string, myId: string) {
    this.myId = myId;
    this.channel = supabase.channel(`clash_match_${matchId}`, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: myId },
      },
    });

    this.channel
      // Game input sync (broadcast — low latency)
      .on('broadcast', { event: 'input' }, ({ payload }: any) => {
        if (payload?.pid !== myId && payload?.inp) {
          this.latestInput = payload.inp;
          this.onInputCb?.(payload.inp);
        }
      })
      // Coordination events (broadcast)
      .on('broadcast', { event: 'coord' }, ({ payload }: any) => {
        if (payload?.pid !== myId && payload?.evt) {
          const cbs = this.eventListeners.get(payload.evt) ?? [];
          cbs.forEach(cb => cb(payload.data ?? {}));
        }
      })
      // Presence sync — fires on join AND whenever anyone updates state
      .on('presence', { event: 'sync' }, () => {
        this.presenceCb?.(this.channel.presenceState() as Record<string, any[]>);
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          this.subscribed = true;
        }
      });
  }

  // ── Presence (for lobby state that must survive late joins) ──────────
  trackPresence(data: Record<string, any>): void {
    this.channel.track(data);
  }

  onPresenceSync(cb: (state: Record<string, any[]>) => void): void {
    this.presenceCb = cb;
    // Fire immediately with current state if already subscribed
    if (this.subscribed) {
      cb(this.channel.presenceState() as Record<string, any[]>);
    }
  }

  // ── Broadcast (for transient events like MATCH_START) ───────────────
  sendEvent(event: string, data?: any): void {
    if (!this.subscribed) {
      // Queue the send until subscribed
      setTimeout(() => this.sendEvent(event, data), 300);
      return;
    }
    this.channel.send({
      type: 'broadcast',
      event: 'coord',
      payload: { pid: this.myId, evt: event, data },
    });
  }

  onEvent(event: string, cb: EventCallback): void {
    const existing = this.eventListeners.get(event) ?? [];
    this.eventListeners.set(event, [...existing, cb]);
  }

  // ── Game input ───────────────────────────────────────────────────────
  sendInput(input: RemoteInput): void {
    if (!this.subscribed) return;
    this.channel.send({
      type: 'broadcast',
      event: 'input',
      payload: { pid: this.myId, inp: input },
    });
  }

  onRemoteInput(cb: (inp: RemoteInput) => void): void {
    this.onInputCb = cb;
  }

  getLatestInput(): RemoteInput | null {
    return this.latestInput;
  }

  isReady(): boolean {
    return this.subscribed;
  }

  disconnect(): void {
    supabase.removeChannel(this.channel);
  }
}
