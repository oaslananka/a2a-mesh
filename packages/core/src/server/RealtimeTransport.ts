/**
 * @file RealtimeTransport.ts
 * Future-readiness placeholder for multimodal / voice connection support.
 */

import { EventEmitter } from 'node:events';

/**
 * Interface representing a duplex multimodal connection.
 * Intended for Future Phase integration with WebRTC or Voice-enabled WebSocket endpoints.
 */
export interface MultimodalSession {
  sessionId: string;
  taskId: string;
  close(): void;
  sendAudio(pcmData: Uint8Array): void;
  sendText(text: string): void;
}

export class VoiceSessionManager extends EventEmitter {
  private activeSessions = new Map<string, MultimodalSession>();

  /**
   * Registers a new multimodal session (e.g. from an incoming WebRTC handshake)
   */
  registerSession(session: MultimodalSession): void {
    this.activeSessions.set(session.sessionId, session);
    this.emit('session_started', session);
  }

  /**
   * Removes an active multimodal session
   */
  endSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.close();
      this.activeSessions.delete(sessionId);
      this.emit('session_ended', sessionId);
    }
  }

  /**
   * Forwards downstream text to an active multimodal session (to be spoken or rendered)
   */
  publishText(taskId: string, text: string): void {
    for (const session of this.activeSessions.values()) {
      if (session.taskId === taskId) {
        session.sendText(text);
      }
    }
  }
}
