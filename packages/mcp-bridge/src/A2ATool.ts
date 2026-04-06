import { A2AClient, createAuthenticatingFetchWithRetry, type Task } from 'a2a-mesh';
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';

export interface A2AMcpToolConfig {
  /** The URL of the A2A Agent */
  agentUrl: string;
  /** Name for the exposed MCP tool */
  name: string;
  /** Description for the exposed MCP tool */
  description: string;
  /** Optional auth token to talk to the A2A Agent */
  token?: string;
  /** Optional ID for resuming sessions */
  sessionId?: string;
}

/**
 * Creates an MCP-compatible Tool definition that proxies requests to an A2A Agent.
 */
export function createMcpToolFromAgent(config: A2AMcpToolConfig): Tool {
  return {
    name: config.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
    description: `[A2A Agent Proxy] ${config.description}`,
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description:
            'The natural language prompt or structured JSON request to send to the underlying A2A agent.',
        },
        contextId: {
          type: 'string',
          description: 'Optional Context ID to correlate a multi-turn conversation.',
        },
      },
      required: ['message'],
    },
  };
}

/**
 * Executes the MCP tool call by forwarding it to the A2A Agent.
 */
export async function handleA2AMcpToolCall(
  config: A2AMcpToolConfig,
  args: { message: string; contextId?: string },
): Promise<CallToolResult> {
  try {
    const fetcher = config.token
      ? createAuthenticatingFetchWithRetry(globalThis.fetch.bind(globalThis), {
          async headers() {
            return { Authorization: `Bearer ${config.token}` };
          },
        })
      : globalThis.fetch.bind(globalThis);

    const client = new A2AClient(config.agentUrl, { fetchImplementation: fetcher });

    const task: Task = await client.sendMessage({
      message: {
        role: 'user',
        parts: [{ type: 'text', text: args.message }],
        messageId: `mcp-bridge-${Date.now()}`,
        timestamp: new Date().toISOString(),
      },
      ...(args.contextId ? { contextId: args.contextId } : {}),
    });

    let finalOutput = '';
    if (task.artifacts && task.artifacts.length > 0) {
      finalOutput = task.artifacts
        .flatMap((a) => a.parts)
        .map((p) => {
          if (p.type === 'text') return p.text;
          if (p.type === 'data') return JSON.stringify(p.data, null, 2);
          return '[Binary File]';
        })
        .join('\\\n\\\n');
    } else {
      finalOutput = `Task generated no artifacts. Final state: ${task.status.state}`;
    }

    return {
      content: [
        {
          type: 'text',
          text: finalOutput,
        },
      ],
      isError: task.status.state === 'failed',
    };
  } catch (error: unknown) {
    return {
      content: [
        {
          type: 'text',
          text: `A2A Agent Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
