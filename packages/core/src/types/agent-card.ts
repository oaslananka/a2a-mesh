/**
 * @file agent-card.ts
 * Types defining the Agent Card structure.
 */

import type { AuthScheme } from './auth.js';
import type { A2AExtension } from './extensions.js';

export type ProtocolVersion = '0.3' | '1.0';

/**
 * Agent capabilities.
 */
export interface AgentCapabilities {
  streaming?: boolean;
  pushNotifications?: boolean;
  stateTransitionHistory?: boolean;
  extendedAgentCard?: boolean; // v1.0.0
  mcpCompatible?: boolean; // Phase 9 future-readiness
  backgroundJobs?: boolean; // Phase 10 future-readiness
}

/**
 * Definition of an agent skill.
 */
export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags?: string[];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
}

/**
 * Legacy v0.3 Agent Card structure.
 */
export interface AgentCardV03 {
  protocolVersion: '0.3';
  name: string;
  description: string;
  url: string;
  iconUrl?: string;
  provider?: {
    name: string;
    url: string;
  };
  version: string;
  capabilities?: AgentCapabilities;
  skills?: AgentSkill[];
  defaultInputMode?: string;
  defaultOutputMode?: string;
  authentication?: AuthScheme[];
  supportsAuthenticatedExtendedCard?: boolean;
}

/**
 * The Canonical v1.0 Agent Card structure.
 */
export interface AgentCard {
  protocolVersion: '1.0';
  name: string;
  description: string;
  url: string;
  iconUrl?: string;
  documentationUrl?: string; // added in 1.0.0 mapping
  provider?: {
    name: string;
    url: string;
  };
  modelHints?: string[]; // E.g., ['gpt-4', 'claude-3']
  transport?: 'http' | 'sse' | 'ws' | 'grpc'; // Transport method
  version: string; // semver
  capabilities?: AgentCapabilities;
  supportedInterfaces?: string[];
  protocolBinding?: string;
  defaultInputModes?: string[]; // plural in 1.0.0 mapping
  defaultOutputModes?: string[]; // plural in 1.0.0 mapping
  skills?: AgentSkill[];
  securitySchemes?: AuthScheme[]; // 1.0.0 uses securitySchemes
  security?: Record<string, string[]>[]; // 1.0.0 uses OpenAPI style
  signatures?: string[];
  extensions?: A2AExtension[];
}

export type AnyAgentCard = AgentCard | AgentCardV03;

export function normalizeAgentCard(card: AnyAgentCard): AgentCard {
  if (card.protocolVersion === '1.0') {
    return card;
  }

  const capabilities: AgentCapabilities | undefined =
    card.capabilities || card.supportsAuthenticatedExtendedCard
      ? {
          ...(card.capabilities ?? {}),
          ...(card.supportsAuthenticatedExtendedCard || card.capabilities?.extendedAgentCard
            ? { extendedAgentCard: true }
            : {}),
        }
      : undefined;

  // Convert v0.3 to v1.0
  return {
    protocolVersion: '1.0',
    name: card.name,
    description: card.description,
    url: card.url,
    version: card.version,
    ...(card.iconUrl ? { iconUrl: card.iconUrl } : {}),
    ...(card.provider ? { provider: card.provider } : {}),
    ...(capabilities ? { capabilities } : {}),
    ...(card.defaultInputMode ? { defaultInputModes: [card.defaultInputMode] } : {}),
    ...(card.defaultOutputMode ? { defaultOutputModes: [card.defaultOutputMode] } : {}),
    ...(card.skills ? { skills: card.skills } : {}),
    ...(card.authentication ? { securitySchemes: card.authentication } : {}),
  };
}
