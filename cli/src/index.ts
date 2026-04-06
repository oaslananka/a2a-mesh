#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import {
  A2AClient,
  AgentRegistryClient,
  normalizeAgentCard,
  type AgentCard,
  type Message,
} from 'a2a-mesh';
import { RegistryServer } from 'a2a-mesh-registry';
import { discoverAgent } from './commands/discover.js';
import {
  scaffoldAgent,
  type ScaffoldAdapter,
  type ScaffoldPackageManager,
} from './commands/scaffold.js';

interface CliOptions {
  json?: boolean;
}

interface MonitorCommandOptions {
  interval: string;
  cycles?: string;
  limit: string;
  contextId?: string;
}

interface BenchmarkCommandOptions {
  requests: string;
  concurrency: string;
  message: string;
}

interface ExportCardCommandOptions {
  output: string;
}

interface MonitoredTask {
  id: string;
  contextId?: string;
  status: {
    state: string;
    timestamp: string;
  };
}

interface TaskListSnapshot {
  tasks: MonitoredTask[];
  total: number;
}

function writeOutput(message: string): void {
  process.stdout.write(`${message}\n`);
}

function writeError(message: string): void {
  process.stderr.write(`${message}\n`);
}

function emitResult(value: unknown, options: CliOptions): void {
  if (options.json) {
    writeOutput(JSON.stringify(value, null, 2));
    return;
  }

  if (typeof value === 'string') {
    writeOutput(value);
    return;
  }

  writeOutput(chalk.cyan(JSON.stringify(value, null, 2)));
}

async function withSpinner<T>(
  label: string,
  options: CliOptions,
  fn: () => Promise<T>,
): Promise<T> {
  if (options.json) {
    return fn();
  }

  const spinner = ora(label).start();
  try {
    const result = await fn();
    spinner.succeed(label);
    return result;
  } catch (error) {
    spinner.fail(label);
    throw error;
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function createCliMessage(text: string): Message {
  return {
    role: 'user',
    parts: [{ type: 'text', text }],
    messageId: `cli-${randomUUID()}`,
    timestamp: new Date().toISOString(),
  };
}

async function monitorTasks(
  url: string,
  commandOptions: MonitorCommandOptions,
  options: CliOptions,
): Promise<void> {
  const client = new A2AClient(url) as A2AClient & {
    listTasks(params: {
      contextId?: string;
      limit?: number;
      offset?: number;
    }): Promise<TaskListSnapshot>;
  };
  const intervalMs = Number(commandOptions.interval);
  const cycles = commandOptions.cycles ? Number(commandOptions.cycles) : Number.POSITIVE_INFINITY;
  const limit = Number(commandOptions.limit);

  let completedCycles = 0;
  while (completedCycles < cycles) {
    const snapshot = await client.listTasks({
      ...(commandOptions.contextId ? { contextId: commandOptions.contextId } : {}),
      limit,
      offset: 0,
    });
    emitResult(
      {
        timestamp: new Date().toISOString(),
        total: snapshot.total,
        tasks: snapshot.tasks.map((task: MonitoredTask) => ({
          id: task.id,
          contextId: task.contextId,
          state: task.status.state,
          updatedAt: task.status.timestamp,
        })),
      },
      options,
    );
    completedCycles += 1;
    if (completedCycles < cycles) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, intervalMs);
      });
    }
  }
}

async function benchmarkAgent(
  url: string,
  commandOptions: BenchmarkCommandOptions,
): Promise<Record<string, number>> {
  const client = new A2AClient(url);
  const requests = Number(commandOptions.requests);
  const concurrency = Number(commandOptions.concurrency);
  const message = commandOptions.message;
  const latencies: number[] = [];
  let cursor = 0;
  let completed = 0;
  let failed = 0;
  const startedAt = Date.now();

  const worker = async (): Promise<void> => {
    while (cursor < requests) {
      const nextRequest = cursor;
      cursor += 1;
      const requestStartedAt = Date.now();
      try {
        await client.sendMessage(createCliMessage(`${message} #${nextRequest + 1}`));
        latencies.push(Date.now() - requestStartedAt);
        completed += 1;
      } catch {
        failed += 1;
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const totalDurationMs = Date.now() - startedAt;
  const averageLatencyMs =
    latencies.length > 0
      ? Number((latencies.reduce((sum, value) => sum + value, 0) / latencies.length).toFixed(2))
      : 0;

  return {
    requests,
    concurrency,
    completed,
    failed,
    averageLatencyMs,
    totalDurationMs,
  };
}

const program = new Command();
program
  .name('a2a')
  .description('A2A Mesh developer CLI')
  .option('--json', 'Machine-readable JSON output');

program
  .command('discover')
  .argument('<url>')
  .action(async (url: string) => {
    const options = program.opts<CliOptions>();
    const card = await withSpinner(`Discovering ${url}`, options, () =>
      discoverAgent(url, options),
    );
    if (options.json) {
      emitResult(card, options);
    }
  });

program
  .command('scaffold')
  .argument('<agent-name>')
  .option('--adapter <adapter>', 'Adapter template to use', 'custom')
  .option('--auth', 'Include API key authentication')
  .option('--rate-limit', 'Include default rate limiting')
  .option('--docker', 'Include Dockerfile')
  .option('--package-manager <packageManager>', 'Preferred package manager', 'npm')
  .action(
    (
      name: string,
      commandOptions: {
        adapter: ScaffoldAdapter;
        auth?: boolean;
        rateLimit?: boolean;
        docker?: boolean;
        packageManager: ScaffoldPackageManager;
      },
    ) => {
      scaffoldAgent(name, {
        adapter: commandOptions.adapter,
        auth: commandOptions.auth ?? false,
        rateLimit: commandOptions.rateLimit ?? false,
        docker: commandOptions.docker ?? false,
        packageManager: commandOptions.packageManager,
      });
    },
  );

const taskCommand = program.command('task').description('Task lifecycle commands');
taskCommand
  .command('send')
  .argument('<url>')
  .argument('<message>')
  .action(async (url: string, message: string) => {
    const options = program.opts<CliOptions>();
    const client = new A2AClient(url);
    const result = await withSpinner('Sending task', options, () =>
      client.sendMessage(createCliMessage(message)),
    );
    emitResult(result, options);
  });

taskCommand
  .command('stream')
  .argument('<url>')
  .argument('<message>')
  .action(async (url: string, message: string) => {
    const options = program.opts<CliOptions>();
    const client = new A2AClient(url);
    const stream = await client.sendMessageStream(createCliMessage(message));
    for await (const event of stream) {
      emitResult(event, options);
    }
  });

taskCommand
  .command('status')
  .argument('<url>')
  .argument('<taskId>')
  .action(async (url: string, taskId: string) => {
    const options = program.opts<CliOptions>();
    const client = new A2AClient(url);
    const task = await withSpinner('Fetching task status', options, () => client.getTask(taskId));
    emitResult(task, options);
  });

taskCommand
  .command('cancel')
  .argument('<url>')
  .argument('<taskId>')
  .action(async (url: string, taskId: string) => {
    const options = program.opts<CliOptions>();
    const client = new A2AClient(url);
    const task = await withSpinner('Canceling task', options, () => client.cancelTask(taskId));
    emitResult(task, options);
  });

const registryCommand = program.command('registry').description('Registry operations');
registryCommand
  .command('start')
  .option('--port <port>', 'Port to listen on', '3099')
  .action((commandOptions: { port: string }) => {
    const server = new RegistryServer();
    server.start(Number(commandOptions.port));
    writeOutput(`Registry listening on ${commandOptions.port}`);
  });

registryCommand
  .command('list')
  .option('--url <url>', 'Registry URL', 'http://localhost:3099')
  .action(async (commandOptions: { url: string }) => {
    const options = program.opts<CliOptions>();
    const client = new AgentRegistryClient(commandOptions.url);
    const agents = await withSpinner('Listing agents', options, () => client.listAgents());
    emitResult(agents, options);
  });

program
  .command('health')
  .argument('<url>')
  .action(async (url: string) => {
    const options = program.opts<CliOptions>();
    const client = new A2AClient(url);
    const health = await withSpinner('Checking health', options, () => client.health());
    emitResult(health, options);
  });

program
  .command('validate')
  .argument('<target>')
  .action(async (target: string) => {
    const options = program.opts<CliOptions>();

    try {
      if (isHttpUrl(target)) {
        const client = new A2AClient(target);
        emitResult(normalizeAgentCard(await client.resolveCard()), options);
        return;
      }

      const card = JSON.parse(readFileSync(resolve(target), 'utf8')) as Parameters<
        typeof normalizeAgentCard
      >[0];
      emitResult(normalizeAgentCard(card), options);
    } catch (error) {
      writeError(`Validation failed: ${String(error)}`);
      process.exitCode = 1;
    }
  });

program
  .command('monitor')
  .argument('<url>')
  .option('--interval <ms>', 'Polling interval in milliseconds', '2000')
  .option('--cycles <count>', 'Number of polling cycles before exit')
  .option('--limit <count>', 'Number of tasks to fetch', '50')
  .option('--context-id <contextId>', 'Filter tasks by context id')
  .action(async (url: string, commandOptions: MonitorCommandOptions) => {
    const options = program.opts<CliOptions>();
    await monitorTasks(url, commandOptions, options);
  });

program
  .command('benchmark')
  .argument('<url>')
  .option('--requests <count>', 'Number of requests to send', '25')
  .option('--concurrency <count>', 'Number of concurrent workers', '5')
  .option('--message <message>', 'Benchmark message text', 'benchmark ping')
  .action(async (url: string, commandOptions: BenchmarkCommandOptions) => {
    const options = program.opts<CliOptions>();
    const result = await withSpinner('Running benchmark', options, () =>
      benchmarkAgent(url, commandOptions),
    );
    emitResult(result, options);
  });

program
  .command('export-card')
  .argument('<url>')
  .option('--output <path>', 'Output path', 'agent-card.json')
  .action(async (url: string, commandOptions: ExportCardCommandOptions) => {
    const options = program.opts<CliOptions>();
    const client = new A2AClient(url);
    const card = await withSpinner<AgentCard>('Exporting agent card', options, () =>
      client.resolveCard(),
    );
    writeFileSync(resolve(commandOptions.output), JSON.stringify(card, null, 2));
    emitResult({ output: resolve(commandOptions.output), name: card.name }, options);
  });

void program.parseAsync(process.argv).catch((error: unknown) => {
  writeError(`CLI failed: ${String(error)}`);
  process.exitCode = 1;
});
