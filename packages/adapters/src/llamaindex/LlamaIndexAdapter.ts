/**
 * @file LlamaIndexAdapter.ts
 * Adapter for LlamaIndex query and chat engines.
 */

import { BaseAdapter } from '../custom/BaseAdapter.js';
import { logger, normalizeAgentCard } from 'a2a-mesh';
import type { AnyAgentCard, ExtensibleArtifact, Message, Part, Task, TextPart } from 'a2a-mesh';

export interface LlamaIndexNodeWithScore {
  score?: number;
  node?: {
    metadata?: Record<string, unknown>;
  };
}

export interface QueryEngineLike {
  query(
    input: string | { query: string },
  ): Promise<string | { response?: string; sourceNodes?: LlamaIndexNodeWithScore[] }>;
}

export interface ChatEngineLike {
  chat(
    input:
      | string
      | {
          message: string;
          stream?: boolean;
          chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
        },
  ): Promise<
    | string
    | { response?: string; message?: string; sourceNodes?: LlamaIndexNodeWithScore[] }
    | AsyncIterable<{ response: string }>
  >;
}

function extractText(parts: Part[]): string {
  return parts
    .filter((part): part is TextPart => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
}

/**
 * Adapter for LlamaIndex query and chat engines.
 *
 * @since 1.0.0
 */
export class LlamaIndexAdapter extends BaseAdapter {
  constructor(
    card: AnyAgentCard,
    private readonly engine: QueryEngineLike | ChatEngineLike,
  ) {
    super(normalizeAgentCard(card));
  }

  async handleTask(task: Task, message: Message): Promise<ExtensibleArtifact[]> {
    logger.info('LlamaIndex processing task', {
      taskId: task.id,
      ...(task.contextId ? { contextId: task.contextId } : {}),
    });
    const input = extractText(message.parts);
    if (!input) {
      throw new Error('LlamaIndex Adapter requires text input');
    }

    if (this.isChatEngine(this.engine)) {
      const chatHistory = task.history
        .filter((entry) => entry.messageId !== message.messageId)
        .map((entry) => ({
          role: (entry.role === 'agent' ? 'assistant' : 'user') as 'assistant' | 'user',
          content: extractText(entry.parts),
        }));
      const response = await this.engine.chat({
        message: input,
        chatHistory,
        stream: task.metadata?.stream === true,
      });
      return [this.toArtifact(response, 'LlamaIndex Chat Response')];
    }

    const response = await this.engine.query({ query: input });
    return [this.toArtifact(response, 'LlamaIndex Query Response')];
  }

  private isChatEngine(engine: QueryEngineLike | ChatEngineLike): engine is ChatEngineLike {
    return 'chat' in engine;
  }

  private toArtifact(
    response:
      | string
      | { response?: string; message?: string; sourceNodes?: LlamaIndexNodeWithScore[] }
      | AsyncIterable<{ response: string }>,
    name: string,
  ): ExtensibleArtifact {
    if (this.isAsyncIterable(response)) {
      throw new Error('Streaming LlamaIndex responses are not supported in handleTask');
    }

    const sourceNodes = typeof response === 'string' ? [] : (response.sourceNodes ?? []);
    const text =
      typeof response === 'string'
        ? response
        : (response.response ?? response.message ?? JSON.stringify(response, null, 2));

    return {
      artifactId: `llamaindex-${Date.now()}`,
      name,
      parts: [{ type: 'text', text }],
      index: 0,
      lastChunk: true,
      metadata: {
        provider: 'llamaindex',
        sourceNodes: sourceNodes.map((node) => ({
          score: node.score,
          metadata: node.node?.metadata ?? {},
        })),
      },
      extensions: sourceNodes.length > 0 ? ['urn:a2a:extensions:llamaindex/source-nodes'] : [],
    };
  }

  private isAsyncIterable(
    value:
      | string
      | { response?: string; message?: string; sourceNodes?: LlamaIndexNodeWithScore[] }
      | AsyncIterable<{ response: string }>,
  ): value is AsyncIterable<{ response: string }> {
    return typeof value === 'object' && value !== null && Symbol.asyncIterator in value;
  }
}
