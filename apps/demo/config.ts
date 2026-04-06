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

function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function readString(name: string, fallback: string): string {
  const raw = process.env[name]?.trim();
  return raw ? raw : fallback;
}

function isLocalRegistry(urlString: string): boolean {
  const url = new URL(urlString);
  return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
}

export interface DemoConfig {
  registryUrl: string;
  registryPort: number;
  registryToken?: string;
  runEmbeddedRegistry: boolean;
  allowPrivateNetworks: boolean;
  researcherPort: number;
  writerPort: number;
  orchestratorPort: number;
  researcherUrl: string;
  writerUrl: string;
  orchestratorUrl: string;
}

export function getDemoConfig(): DemoConfig {
  const registryUrl = readString('REGISTRY_URL', 'http://localhost:3099');
  const registryPort = Number(new URL(registryUrl).port || '3099');
  const researcherPort = readPort('PORT_RESEARCHER', 3001);
  const writerPort = readPort('PORT_WRITER', 3002);
  const orchestratorPort = readPort('PORT_ORCHESTRATOR', 3003);
  const registryToken = process.env.REGISTRY_TOKEN?.trim() || undefined;

  return {
    registryUrl,
    registryPort,
    runEmbeddedRegistry: readBoolean('RUN_EMBEDDED_REGISTRY', isLocalRegistry(registryUrl)),
    allowPrivateNetworks: readBoolean('ALLOW_PRIVATE_NETWORKS', false),
    researcherPort,
    writerPort,
    orchestratorPort,
    researcherUrl: readString('RESEARCHER_URL', `http://localhost:${researcherPort}`),
    writerUrl: readString('WRITER_URL', `http://localhost:${writerPort}`),
    orchestratorUrl: readString('ORCHESTRATOR_URL', `http://localhost:${orchestratorPort}`),
    ...(registryToken ? { registryToken } : {}),
  };
}
