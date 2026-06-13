// WebSocketManager.ts — Client-side WebSocket connection for online PVP
// Connects to the CLASH game server and handles all real-time communication

import type { PlayerInput, GameState, GameMode, LobbyType } from './types';
export type { PlayerInput, GameState, GameMode, LobbyType } from './types';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'authenticated' | 'error';
export type GameStatus = 'none' | 'lobby' | 'countdown' | 'playing' | 'ended';

export interface LobbyPlayer {
  playerId: string;
  username: string;
  character: string;
  ready: boolean;
  isHost: boolean;
}

export interface MatchResult {
  playerId: string;
  username: string;
  lives: number;
  damage: number;
  isWinner: boolean;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private playerId: string | null = null;
  private roomCode: string | null = null;
  private connectionState: ConnectionStatus = 'disconnected';

  // BUG 2 FIX: Flag to prevent auto-reconnect on intentional disconnect
  private intentionalDisconnect = false;

  // Callbacks
  private onStatusChange: ((status: ConnectionStatus) => void) | null = null;
  private onGameStatusChange: ((status: GameStatus) => void) | null = null;
  private onLobbyUpdate: ((players: LobbyPlayer[], status: string, roomCode?: string) => void) | null = null;
  private onGameState: ((state: GameState) => void) | null = null;
  private onCountdown: ((seconds: number) => void) | null = null;
  private onMatchStart: ((players: any[], stage: string) => void) | null = null;
  private onMatchEnd: ((results: MatchResult[]) => void) | null = null;
  private onPlayerJoined: ((player: LobbyPlayer) => void) | null = null;
  private onPlayerLeft: ((playerId: string) => void) | null = null;
  private onError: ((code: string, message: string) => void) | null = null;
  private onChat: ((playerId: string, username: string, message: string) => void) | null = null;
  private onLatencyUpdate: ((latency: number) => void) | null = null;

  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private serverUrl: string;

  constructor(serverUrl?: string) {
    // Default to localhost for development, override with env or param
    this.serverUrl = serverUrl || import.meta.env.VITE_WS_URL || 'ws://localhost:8081';
  }

  // ── Connection ────────────────────────────────────────────────────
  connect(authToken: string): void {
    if (this.ws?.readyState === WebSocket.OPEN ||
        this.ws?.readyState === WebSocket.CONNECTING) return;

    // BUG 2 FIX: Reset intentional disconnect flag on new connection
    this.intentionalDisconnect = false;

    this.setStatus('connecting');

    try {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        console.log('[WS] Connected');
        this.reconnectAttempts = 0;
        // Authenticate immediately
        this.send({ type: 'AUTHENTICATE', token: authToken });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (err) {
          console.error('[WS] Failed to parse message:', err);
        }
      };

      this.ws.onclose = () => {
        console.log('[WS] Disconnected');
        this.setStatus('disconnected');
        this.cleanup();
        // BUG 2 FIX: Don't attempt reconnect if disconnect was intentional
        if (this.intentionalDisconnect) {
          this.intentionalDisconnect = false;
          return;
        }
        this.attemptReconnect(authToken);
      };

      this.ws.onerror = (err) => {
        console.error('[WS] Error:', err);
        this.setStatus('error');
        this.onError?.('WS_ERROR', 'Connection error');
      };
    } catch (err) {
      console.error('[WS] Failed to connect:', err);
      this.setStatus('error');
    }
  }

  disconnect(): void {
    // BUG 2 FIX: Set flag before closing to prevent auto-reconnect
    this.intentionalDisconnect = true;
    this.cleanup();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private attemptReconnect(authToken: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WS] Max reconnect attempts reached');
      this.onError?.('RECONNECT_FAILED', 'Could not reconnect to server');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect(authToken);
    }, delay);
  }

  // ── Message Handling ──────────────────────────────────────────────
  private handleMessage(msg: any): void {
    switch (msg.type) {
      case 'AUTHENTICATED':
        this.playerId = msg.playerId;
        this.setStatus('authenticated');
        this.startPing();
        break;

      case 'LOBBY_UPDATE':
        this.onLobbyUpdate?.(msg.players, msg.status, msg.roomCode);
        break;

      case 'ROOM_CREATED':
        this.roomCode = msg.roomCode;
        break;

      case 'MATCH_FOUND':
        this.roomCode = msg.roomCode;
        this.onLobbyUpdate?.(msg.players, 'found', msg.roomCode);
        break;

      case 'COUNTDOWN':
        this.setGameStatus('countdown');
        this.onCountdown?.(msg.seconds);
        break;

      case 'MATCH_START':
        this.setGameStatus('playing');
        this.onMatchStart?.(msg.players, msg.stage);
        break;

      case 'GAME_STATE':
        this.onGameState?.(msg.state);
        break;

      case 'MATCH_END':
        this.setGameStatus('ended');
        this.onMatchEnd?.(msg.results);
        break;

      case 'PLAYER_JOINED':
        this.onPlayerJoined?.({
          playerId: msg.playerId,
          username: msg.username,
          character: msg.character || 'assassin',
          ready: false,
          isHost: false,
        });
        break;

      case 'PLAYER_LEFT':
        this.onPlayerLeft?.(msg.playerId);
        break;

      case 'PLAYER_READY':
        // Handled by LOBBY_UPDATE
        break;

      case 'PLAYER_KO':
        // Handled by GAME_STATE events
        break;

      case 'CHAT':
        this.onChat?.(msg.playerId, msg.username, msg.message);
        break;

      case 'PONG':
        const latency = Date.now() - msg.timestamp;
        this.onLatencyUpdate?.(latency);
        break;

      case 'ERROR':
        console.error('[WS] Server error:', msg.code, msg.message);
        this.onError?.(msg.code, msg.message);
        break;

      default:
        console.warn('[WS] Unknown message type:', (msg as any).type);
        break;
    }
  }

  // ── Actions ───────────────────────────────────────────────────────
  createRoom(settings: { maxPlayers: number; gameMode: GameMode; isPrivate: boolean; stage?: string }): void {
    this.send({ type: 'CREATE_ROOM', settings });
  }

  joinRoom(roomCode: string): void {
    this.send({ type: 'JOIN_ROOM', roomCode });
  }

  joinLobby(lobbyType: LobbyType): void {
    this.send({ type: 'JOIN_LOBBY', lobbyType });
  }

  leaveRoom(): void {
    this.send({ type: 'LEAVE_ROOM' });
    this.roomCode = null;
  }

  setReady(ready: boolean): void {
    this.send({ type: 'READY', ready });
  }

  selectCharacter(character: string): void {
    this.send({ type: 'SELECT_CHARACTER', character });
  }

  sendInput(input: PlayerInput): void {
    this.send({ type: 'PLAYER_INPUT', input });
  }

  sendChat(message: string): void {
    this.send({ type: 'CHAT', message });
  }

  authenticate(userId: string, username: string): void {
    if (this.connectionState === 'disconnected') {
      console.warn('[WS] Cannot authenticate, not connected');
      return;
    }
    const token = JSON.stringify({ id: userId, username });
    this.send({ type: 'AUTHENTICATE', token });
  }

  // ── Private helpers ───────────────────────────────────────────────
  // BUG 3 FIX: Wrap ws.send() in try-catch
  private send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
      } catch (err) {
        console.error('[WS] Send failed:', err);
      }
    } else {
      console.warn('[WS] Cannot send, not connected');
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this.connectionState = status;
    this.onStatusChange?.(status);
  }

  private setGameStatus(status: GameStatus): void {
    this.onGameStatusChange?.(status);
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      this.send({ type: 'PING', timestamp: Date.now() });
    }, 5000);
  }

  // ── Getters ───────────────────────────────────────────────────────
  getPlayerId(): string | null { return this.playerId; }
  getRoomCode(): string | null { return this.roomCode; }
  isConnected(): boolean { return this.ws?.readyState === WebSocket.OPEN; }

  // ── Callback setters ──────────────────────────────────────────────
  on(event: string, callback: any): void {
    switch (event) {
      case 'statusChange': this.onStatusChange = callback; break;
      case 'gameStatusChange': this.onGameStatusChange = callback; break;
      case 'lobbyUpdate': this.onLobbyUpdate = callback; break;
      case 'gameState': this.onGameState = callback; break;
      case 'countdown': this.onCountdown = callback; break;
      case 'matchStart': this.onMatchStart = callback; break;
      case 'matchEnd': this.onMatchEnd = callback; break;
      case 'playerJoined': this.onPlayerJoined = callback; break;
      case 'playerLeft': this.onPlayerLeft = callback; break;
      case 'error': this.onError = callback; break;
      case 'chat': this.onChat = callback; break;
      case 'latency': this.onLatencyUpdate = callback; break;
    }
  }
}
