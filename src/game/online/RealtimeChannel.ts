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
  private subscribed = false;

  constructor(matchId: string, myId: string) {
    this.myId = myId;
    this.channel = supabase.channel(`clash_match_${matchId}`, {
      config: { broadcast: { self: false, ack: false } },
    });

    this.channel
      .on('broadcast', { event: 'input' }, ({ payload }: any) => {
        if (payload?.pid !== myId && payload?.inp) {
          this.latestInput = payload.inp;
          this.onInputCb?.(payload.inp);
        }
      })
      .on('broadcast', { event: 'coord' }, ({ payload }: any) => {
        if (payload?.pid !== myId && payload?.evt) {
          const cbs = this.eventListeners.get(payload.evt) ?? [];
          cbs.forEach(cb => cb(payload.data));
        }
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') this.subscribed = true;
      });
  }

  sendInput(input: RemoteInput): void {
    if (!this.subscribed) return;
    this.channel.send({
      type: 'broadcast',
      event: 'input',
      payload: { pid: this.myId, inp: input },
    });
  }

  // Send a coordination event to the opponent
  sendEvent(event: string, data?: any): void {
    this.channel.send({
      type: 'broadcast',
      event: 'coord',
      payload: { pid: this.myId, evt: event, data },
    });
  }

  // Listen for a coordination event from the opponent
  onEvent(event: string, cb: EventCallback): void {
    const existing = this.eventListeners.get(event) ?? [];
    this.eventListeners.set(event, [...existing, cb]);
  }

  getLatestInput(): RemoteInput | null {
    return this.latestInput;
  }

  onRemoteInput(cb: (inp: RemoteInput) => void): void {
    this.onInputCb = cb;
  }

  isReady(): boolean {
    return this.subscribed;
  }

  disconnect(): void {
    supabase.removeChannel(this.channel);
  }
}
