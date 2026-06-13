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

export class RealtimeChannel {
  private channel: ReturnType<typeof supabase.channel>;
  private myId: string;
  private onInputCb: ((inp: RemoteInput) => void) | null = null;
  private latestInput: RemoteInput | null = null;
  private ready = false;

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
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') this.ready = true;
      });
  }

  sendInput(input: RemoteInput): void {
    if (!this.ready) return;
    this.channel.send({
      type: 'broadcast',
      event: 'input',
      payload: { pid: this.myId, inp: input },
    });
  }

  getLatestInput(): RemoteInput | null {
    return this.latestInput;
  }

  onRemoteInput(cb: (inp: RemoteInput) => void): void {
    this.onInputCb = cb;
  }

  isReady(): boolean {
    return this.ready;
  }

  disconnect(): void {
    supabase.removeChannel(this.channel);
  }
}
