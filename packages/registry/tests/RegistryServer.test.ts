import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { RegistryServer } from '../src/RegistryServer.js';

describe('RegistryServer', () => {
  let server: RegistryServer;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('validates agent URL during registration', async () => {
    server = new RegistryServer({ allowLocalhost: false });

    const response = await request(server['app'])
      .post('/agents/register')
      .send({
        agentUrl: 'http://127.0.0.1:3000',
        agentCard: { name: 'Test', version: '1.0', protocolVersion: '1.0' },
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid agentUrl');
  });

  it('allows registration with safe URL', async () => {
    server = new RegistryServer({ allowLocalhost: false });

    const response = await request(server['app'])
      .post('/agents/register')
      .send({
        agentUrl: 'https://example.com/agent',
        agentCard: { name: 'Test', version: '1.0', protocolVersion: '1.0' },
      });

    expect(response.status).toBe(201);
    expect(response.body.url).toBe('https://example.com/agent');
  });

  it('enforces authentication when required', async () => {
    server = new RegistryServer({
      requireAuth: true,
      registrationToken: 'secret123',
      allowLocalhost: true,
    });

    // Without token
    let response = await request(server['app'])
      .post('/agents/register')
      .send({
        agentUrl: 'https://example.com',
        agentCard: { name: 'Test', version: '1.0', protocolVersion: '1.0' },
      });
    expect(response.status).toBe(401);

    // With wrong token
    response = await request(server['app'])
      .post('/agents/register')
      .set('Authorization', 'Bearer wrong')
      .send({
        agentUrl: 'https://example.com',
        agentCard: { name: 'Test', version: '1.0', protocolVersion: '1.0' },
      });
    expect(response.status).toBe(401);

    // With correct token
    response = await request(server['app'])
      .post('/agents/register')
      .set('Authorization', 'Bearer secret123')
      .send({
        agentUrl: 'https://example.com',
        agentCard: { name: 'Test', version: '1.0', protocolVersion: '1.0' },
      });
    expect(response.status).toBe(201);
  });
});
