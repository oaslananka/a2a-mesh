import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JsonRpcError, ErrorCodes } from 'a2a-mesh';
import { WsClient } from '../src/WsClient.js';
import { WsServer } from '../src/WsServer.js';

describe('WsServer + WsClient', () => {
  let server: WsServer;
  let port: number;

  beforeAll(async () => {
    server = new WsServer({
      async handleRequest(request) {
        if (request.method === 'ping') {
          return { pong: true };
        }

        throw new JsonRpcError(ErrorCodes.MethodNotFound, 'Unknown method');
      },
    });

    port = await server.start();
  });

  afterAll(async () => {
    await server.close();
  });

  it('sends a request and receives a response', async () => {
    const client = new WsClient(`ws://127.0.0.1:${port}/a2a-mesh-ws`);
    await client.connect();

    const result = await client.request<{ pong: boolean }>('ping', {});

    expect(result).toEqual({ pong: true });
    await client.close();
  });

  it('returns an error for unknown methods', async () => {
    const client = new WsClient(`ws://127.0.0.1:${port}/a2a-mesh-ws`);
    await client.connect();

    await expect(client.request('unknown', {})).rejects.toThrow('Unknown method');
    await client.close();
  });
});
