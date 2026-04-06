# Realtime & Multimodal Future

This document details the upcoming strategy for handling realtime agent connections within the `a2a-mesh` platform.

## Current Capability

Right now, tasks rely on HTTP Polling, JSON-RPC, or one-way Server-Sent Events (SSE). The `SSEStreamer` effectively transmits streaming tokens, logs, and state updates back to a client in real-time.

## Future Ambition (Phase 10 Placeholder)

The Agent2Agent (A2A) protocol has plans to support seamless real-time connections capable of:

1. **Bi-directional WebSockets (WS)**
2. **WebRTC for Audio/Video Data Streams**

To facilitate this transition in the future, the `a2a-mesh` project has reserved placeholder interfaces (`MultimodalSession` and `VoiceSessionManager`) within the `packages/core/src/server/RealtimeTransport.ts` module.

### How it will work

When WebRTC/Voice APIs (like OpenAI's Realtime API) become standard protocol features:

- A new adapter (e.g. `VoiceAdapter`) will accept raw PCM or Opus buffers.
- The `A2AServer` will upgrade the incoming request to a WebSocket or WebRTC connection.
- The existing `TaskManager` will continue to govern the state, but `message/stream` will become fully duplex.
