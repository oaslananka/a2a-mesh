import { A2AClient, type A2AClientOptions } from 'a2a-mesh';
import type { A2ATestServer } from './A2ATestServer.js';

export class MockA2AClient extends A2AClient {
  static fromServer(server: A2ATestServer, options: A2AClientOptions = {}): MockA2AClient {
    return new MockA2AClient(server.url, options);
  }
}
