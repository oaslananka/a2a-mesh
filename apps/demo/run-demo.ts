import 'dotenv/config';
import { A2AClient } from 'a2a-mesh';
import { getDemoConfig } from './config.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSmokeTest() {
  const config = getDemoConfig();
  const client = new A2AClient(config.orchestratorUrl);

  process.stdout.write('Running smoke test against orchestrator...\n');

  const task = await client.sendMessage({
    role: 'user',
    messageId: `smoke-${Date.now()}`,
    timestamp: new Date().toISOString(),
    parts: [
      {
        type: 'text',
        text: 'Briefly explain what the A2A Protocol is in 2 sentences.',
      },
    ],
  });

  process.stdout.write(`Task created: ${task.id}\n`);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    await sleep(1_000);
    const nextTask = await client.getTask(task.id);
    process.stdout.write(`  Status: ${nextTask.status.state}\n`);

    if (nextTask.status.state === 'completed') {
      const textPart = nextTask.artifacts
        ?.flatMap((artifact: NonNullable<typeof nextTask.artifacts>[number]) => artifact.parts)
        .find((part) => part.type === 'text');

      process.stdout.write('\n✅ Smoke test passed!\n');
      process.stdout.write(
        `Response: ${textPart?.type === 'text' ? textPart.text : '(no text artifact)'}\n`,
      );
      process.exit(0);
    }

    if (nextTask.status.state === 'failed' || nextTask.status.state === 'canceled') {
      throw new Error(`Task ended in state ${nextTask.status.state}`);
    }
  }

  throw new Error('Timed out waiting for task completion');
}

runSmokeTest().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
