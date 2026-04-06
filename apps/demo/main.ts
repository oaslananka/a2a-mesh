import 'dotenv/config';
import type { Server } from 'node:http';
import { AgentRegistryClient, type AgentCard } from 'a2a-mesh';
import { RegistryServer } from 'a2a-mesh-registry';
import { getDemoConfig } from './config.js';
import { OrchestratorAgent } from './orchestrator-agent.js';
import { ResearcherAgent } from './researcher-agent.js';
import { createWriterAgent } from './writer-agent.js';

interface DemoAgent {
  start(port: number): Server;
  stop(): void;
  getAgentCard(): AgentCard;
}

function createRegistryFetch(token?: string): typeof fetch {
  return async (input, init = {}) => {
    const headers = new Headers(init.headers ?? {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return fetch(input, {
      ...init,
      headers,
    });
  };
}

async function waitForListening(server: Server): Promise<void> {
  if (server.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
}

async function ensureRegistryStarted(config: ReturnType<typeof getDemoConfig>) {
  const registryFetch = createRegistryFetch(config.registryToken);
  const registryClient = new AgentRegistryClient(config.registryUrl, registryFetch);

  try {
    await registryClient.health();
    return {
      registryClient,
      shutdown: () => {},
    };
  } catch (error) {
    if (!config.runEmbeddedRegistry) {
      throw error;
    }
  }

  const registry = new RegistryServer({
    allowLocalhost: true,
    allowPrivateNetworks: config.allowPrivateNetworks,
    requireAuth: Boolean(config.registryToken),
    ...(config.registryToken ? { registrationToken: config.registryToken } : {}),
  });
  const server = registry.start(config.registryPort);
  await waitForListening(server);

  return {
    registryClient,
    shutdown: () => {
      registry.stop();
      server.close();
    },
  };
}

async function startAgent(server: DemoAgent, port: number): Promise<Server> {
  const httpServer = server.start(port);
  await waitForListening(httpServer);
  return httpServer;
}

async function main() {
  const config = getDemoConfig();

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required. Copy .env.example to .env and add your key.');
  }

  const { registryClient, shutdown } = await ensureRegistryStarted(config);

  const researcher = new ResearcherAgent(config.researcherUrl) as unknown as DemoAgent;
  const writer = createWriterAgent(config.writerUrl) as unknown as DemoAgent;
  const orchestrator = new OrchestratorAgent({
    url: config.orchestratorUrl,
    researcherUrl: config.researcherUrl,
    writerUrl: config.writerUrl,
  }) as unknown as DemoAgent;

  const researcherServer = await startAgent(researcher, config.researcherPort);
  const writerServer = await startAgent(writer, config.writerPort);
  const orchestratorServer = await startAgent(orchestrator, config.orchestratorPort);

  const registeredAgents = await Promise.all([
    registryClient.register(config.researcherUrl, researcher.getAgentCard()),
    registryClient.register(config.writerUrl, writer.getAgentCard()),
    registryClient.register(config.orchestratorUrl, orchestrator.getAgentCard()),
  ]);

  await Promise.all(
    registeredAgents.map((agent: { id: string }) => registryClient.sendHeartbeat(agent.id)),
  );

  const heartbeatInterval = setInterval(() => {
    void Promise.allSettled(
      registeredAgents.map((agent: { id: string }) => registryClient.sendHeartbeat(agent.id)),
    );
  }, 15_000);

  const closeAll = () => {
    clearInterval(heartbeatInterval);
    researcher.stop();
    writer.stop();
    orchestrator.stop();
    researcherServer.close();
    writerServer.close();
    orchestratorServer.close();
    shutdown();
  };

  process.once('SIGINT', closeAll);
  process.once('SIGTERM', closeAll);

  process.stdout.write(
    [
      '🚀 a2a-mesh demo is running!',
      `Registry:      ${config.registryUrl}`,
      `Researcher:    ${config.researcherUrl}`,
      `Writer:        ${config.writerUrl}`,
      `Orchestrator:  ${config.orchestratorUrl}`,
      '',
      'Try it:',
      `curl -X POST ${config.orchestratorUrl}/rpc \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d "{\\"jsonrpc\\":\\"2.0\\",\\"id\\":\\"1\\",\\"method\\":\\"message/send\\",\\"params\\":{\\"message\\":{\\"role\\":\\"user\\",\\"messageId\\":\\"demo-1\\",\\"timestamp\\":\\"2026-04-06T00:00:00.000Z\\",\\"parts\\":[{\\"type\\":\\"text\\",\\"text\\":\\"What is the A2A Protocol?\\"}]}}}"`,
      '',
      'Smoke test:',
      'npm run smoke-test',
    ].join('\n') + '\n',
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
