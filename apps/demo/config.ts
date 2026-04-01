function readPort(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid port for ${name}: ${raw}`);
  }

  return parsed;
}

export interface DemoConfig {
  registryPort: number;
  orchestratorPort: number;
  researcherPort: number;
  writerPort: number;
  registryUrl: string;
  orchestratorUrl: string;
  researcherUrl: string;
  writerUrl: string;
}

export function getDemoConfig(): DemoConfig {
  const registryPort = readPort('REGISTRY_PORT', 3099);
  const orchestratorPort = readPort('ORCHESTRATOR_PORT', 3100);
  const researcherPort = readPort('RESEARCHER_PORT', 3101);
  const writerPort = readPort('WRITER_PORT', 3102);

  return {
    registryPort,
    orchestratorPort,
    researcherPort,
    writerPort,
    registryUrl: `http://localhost:${registryPort}`,
    orchestratorUrl: `http://localhost:${orchestratorPort}`,
    researcherUrl: `http://localhost:${researcherPort}`,
    writerUrl: `http://localhost:${writerPort}`,
  };
}
