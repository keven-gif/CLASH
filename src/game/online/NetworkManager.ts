export interface NetworkInput {
  frame: number;
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

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'failed';

export class NetworkManager {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private state: ConnectionState = 'idle';
  private onStateChange: ((s: ConnectionState) => void) | null = null;
  private onInputCb: ((i: NetworkInput) => void) | null = null;
  private inputBuffer = new Map<number, NetworkInput>();
  private localFrame = 0;
  private delayFrames = 3;

  private iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  // ── Host: create offer ───────────────────────────────────────────────
  async createOffer(): Promise<string> {
    this.pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.setupPC();
    this.dc = this.pc.createDataChannel('game', { ordered: true, maxRetransmits: 0 });
    this.setupDC();
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this.waitIce();
    this.setState('connecting');
    return JSON.stringify(this.pc.localDescription);
  }

  // ── Client: accept offer, create answer ──────────────────────────────
  async acceptOffer(offerSdp: string): Promise<string> {
    const offer = JSON.parse(offerSdp);
    this.pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.setupPC();
    this.pc.ondatachannel = (e) => { this.dc = e.channel; this.setupDC(); };
    await this.pc.setRemoteDescription(offer);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await this.waitIce();
    this.setState('connecting');
    return JSON.stringify(this.pc.localDescription);
  }

  // ── Host: accept answer ──────────────────────────────────────────────
  async acceptAnswer(answerSdp: string): Promise<void> {
    if (!this.pc) return;
    await this.pc.setRemoteDescription(JSON.parse(answerSdp));
  }

  // ── Internal setup ───────────────────────────────────────────────────
  private setupPC(): void {
    if (!this.pc) return;
    this.pc.onconnectionstatechange = () => {
      const s = this.pc?.connectionState;
      if (s === 'connected') this.setState('connected');
      else if (s === 'disconnected' || s === 'closed') this.setState('disconnected');
      else if (s === 'failed') this.setState('failed');
    };
  }

  private setupDC(): void {
    if (!this.dc) return;
    this.dc.onopen = () => this.setState('connected');
    this.dc.onmessage = (e) => {
      try { const inp: NetworkInput = JSON.parse(e.data); this.inputBuffer.set(inp.frame, inp); this.onInputCb?.(inp); }
      catch { /* ignore */ }
    };
    this.dc.onclose = () => this.setState('disconnected');
  }

  private waitIce(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.pc) { resolve(); return; }
      const t = setTimeout(() => resolve(), 3000);
      this.pc.onicegatheringstatechange = () => {
        if (this.pc?.iceGatheringState === 'complete') { clearTimeout(t); resolve(); }
      };
    });
  }

  private setState(s: ConnectionState): void {
    this.state = s;
    this.onStateChange?.(s);
  }

  // ── Public API ───────────────────────────────────────────────────────
  sendInput(input: NetworkInput): void {
    if (this.dc?.readyState === 'open') this.dc.send(JSON.stringify(input));
  }

  getInputForFrame(frame: number): NetworkInput | null {
    const inp = this.inputBuffer.get(frame);
    if (inp) this.inputBuffer.delete(frame);
    return inp ?? null;
  }

  hasInputForFrame(frame: number): boolean { return this.inputBuffer.has(frame); }
  getState(): ConnectionState { return this.state; }
  getLocalFrame(): number { return this.localFrame; }
  incrementFrame(): void { this.localFrame++; }
  getDelayFrames(): number { return this.delayFrames; }

  onConnectionStateChange(cb: (s: ConnectionState) => void): void { this.onStateChange = cb; }
  onRemoteInput(cb: (i: NetworkInput) => void): void { this.onInputCb = cb; }

  disconnect(): void {
    this.dc?.close(); this.pc?.close();
    this.dc = null; this.pc = null;
    this.inputBuffer.clear();
    this.localFrame = 0;
    this.setState('idle');
  }
}
