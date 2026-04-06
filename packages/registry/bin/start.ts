import { RegistryServer } from '../src/index.js';

function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

const port = Number(process.env.PORT ?? '3099');
const registrationToken = process.env.REGISTRY_TOKEN?.trim() || undefined;

const server = new RegistryServer({
  allowLocalhost: readBoolean('ALLOW_LOCALHOST', true),
  allowPrivateNetworks: readBoolean('ALLOW_PRIVATE_NETWORKS', false),
  requireAuth: Boolean(registrationToken),
  ...(registrationToken ? { registrationToken } : {}),
});

server.start(port);
process.stdout.write(`Registry running on :${port}\n`);
