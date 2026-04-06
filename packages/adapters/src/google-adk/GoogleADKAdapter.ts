/**
 * @file GoogleADKAdapter.ts
 * HTTP adapter for deployed Google Agent Development Kit agents.
 */

import { BaseAdapter } from '../custom/BaseAdapter.js';
import { fetchWithPolicy } from 'a2a-mesh';
import { logger, normalizeAgentCard } from 'a2a-mesh';
import type {
  AnyAgentCard,
  Artifact,
  ExtensibleArtifact,
  Message,
  Part,
  Task,
  TextPart,
} from 'a2a-mesh';

function extractText(parts: Part[]): string {
  return parts
    .filter((part): part is TextPart => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
}

/**
 * Remote HTTP adapter for Google Agent Development Kit deployments.
 *
 * @experimental
 * @since 1.0.0
 */
export class GoogleADKAdapter extends BaseAdapter {
  constructor(
    card: AnyAgentCard,
    private readonly adkEndpoint: string,
    private readonly apiKey?: string,
  ) {
    super(normalizeAgentCard(card));
  }

  async handleTask(task: Task, message: Message): Promise<Artifact[]> {
    logger.info('Google ADK processing task', {
      taskId: task.id,
      ...(task.contextId ? { contextId: task.contextId } : {}),
    });

    const history = task.history.map((entry) => ({
      role: entry.role === 'agent' ? 'model' : 'user',
      content: extractText(entry.parts),
    }));

    const response = await fetchWithPolicy(
      this.adkEndpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'x-goog-api-key': this.apiKey } : {}),
        },
        body: JSON.stringify({
          taskId: task.id,
          contextId: task.contextId,
          message: extractText(message.parts),
          history,
        }),
      },
      { timeoutMs: 60000, retries: 2 },
    );

    if (!response.ok) {
      throw new Error(`Google ADK request failed with status ${response.status}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('text/event-stream')) {
      const body = response.body;
      if (!body) {
        throw new Error('Google ADK stream response has no body');
      }

      // To yield items back from an adapter, a2a-mesh expects an array of Artifacts.
      // However, BaseAdapter handles streaming if handleTask is awaited.
      // To properly stream in Node v24, we would yield artifacts incrementally,
      // but handleTask returns a Promise<Artifact[]>.
      // For now, we simulate full buffer parsing incrementally and return it.
      // Note: A true stream implementation in A2A adapters would require generator changes to BaseAdapter.
      // This step incrementally parses the text to avoid memory spikes from `await response.text()`.

      const reader = body.getReader();
      const decoder = new TextDecoder();
      let chunks = '';
      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              chunks += line.slice('data: '.length) + '\n';
            }
          }
        }
      }
      if (buffer && buffer.startsWith('data: ')) {
        chunks += buffer.slice('data: '.length) + '\n';
      }

      const artifact: ExtensibleArtifact = {
        artifactId: `google-adk-${Date.now()}`,
        name: 'Google ADK Stream Response',
        parts: [{ type: 'text', text: chunks.trim() }],
        index: 0,
        lastChunk: true,
        metadata: {
          provider: 'google-adk',
          streamed: true,
        },
      };
      return [artifact];
    }

    const json = (await response.json()) as {
      output?: string;
      result?: string;
      metadata?: Record<string, unknown>;
    };
    const artifact: ExtensibleArtifact = {
      artifactId: `google-adk-${Date.now()}`,
      name: 'Google ADK Response',
      parts: [{ type: 'text', text: json.output ?? json.result ?? '' }],
      index: 0,
      lastChunk: true,
      metadata: {
        provider: 'google-adk',
        ...(json.metadata ?? {}),
      },
    };
    return [artifact];
  }
}
