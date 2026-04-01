/**
 * @file GoogleADKAdapter.ts
 * HTTP adapter for deployed Google Agent Development Kit agents.
 */

import { BaseAdapter } from '../custom/BaseAdapter.js';
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

    const response = await fetch(this.adkEndpoint, {
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
    });

    if (!response.ok) {
      throw new Error(`Google ADK request failed with status ${response.status}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('text/event-stream')) {
      const text = await response.text();
      const chunks = text
        .split('\n')
        .filter((line) => line.startsWith('data: '))
        .map((line) => line.slice('data: '.length))
        .join('\n');
      const artifact: ExtensibleArtifact = {
        artifactId: `google-adk-${Date.now()}`,
        name: 'Google ADK Stream Response',
        parts: [{ type: 'text', text: chunks }],
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
