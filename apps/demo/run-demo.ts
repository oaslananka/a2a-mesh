import type { Server } from 'node:http';
import { AgentRegistryClient } from 'a2a-mesh';
import { RegistryServer } from 'a2a-mesh-registry';
import { getDemoConfig } from './config.js';
import { OrchestratorAgent } from './orchestrator-agent.js';
import { ResearcherAgent } from './researcher-agent.js';
import { WriterAgent } from './writer-agent.js';

async function waitForListening(server: Server): Promise<void> {
  if (server.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
}

const config = getDemoConfig();
const registry = new RegistryServer();
const researcher = new ResearcherAgent(config.researcherUrl);
const writer = new WriterAgent(config.writerUrl);
const orchestrator = new OrchestratorAgent(config.registryUrl, config.orchestratorUrl);

const registryServer = registry.start(config.registryPort);
const researcherServer = researcher.start(config.researcherPort);
const writerServer = writer.start(config.writerPort);
const orchestratorServer = orchestrator.start(config.orchestratorPort);

await Promise.all([
  waitForListening(registryServer),
  waitForListening(researcherServer),
  waitForListening(writerServer),
  waitForListening(orchestratorServer),
]);

const registryClient = new AgentRegistryClient(config.registryUrl);
const registeredAgents = await Promise.all([
  registryClient.register(config.researcherUrl, researcher.getAgentCard()),
  registryClient.register(config.writerUrl, writer.getAgentCard()),
  registryClient.register(config.orchestratorUrl, orchestrator.getAgentCard()),
]);

await Promise.all(registeredAgents.map((agent: { id: string }) => registryClient.sendHeartbeat(agent.id)));

const heartbeatInterval = setInterval(() => {
  void Promise.allSettled(
    registeredAgents.map((agent: { id: string }) => registryClient.sendHeartbeat(agent.id)),
  );
}, 15_000);

const shutdown = () => {
  clearInterval(heartbeatInterval);
  registry.stop();
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

process.stdout.write(
  [
    'Demo services started:',
    `- Registry: ${config.registryUrl}`,
    `- Orchestrator: ${config.orchestratorUrl}`,
    `- Researcher: ${config.researcherUrl}`,
    `- Writer: ${config.writerUrl}`,
    `Registered agents: ${registeredAgents.length}`,
  ].join('\n') + '\n',
);
