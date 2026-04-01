# Adapters

## Overview

Adapters translate provider-native execution models into A2A tasks, artifacts, and stream events.

## Available adapters

| Adapter | Use when | Notes |
| --- | --- | --- |
| `OpenAIAdapter` | You want Chat Completions-compatible agents | Best for OpenAI-backed task execution |
| `AnthropicAdapter` | You want Claude Messages or tool-use support | Preserves token usage in artifact metadata |
| `LangChainAdapter` | You already have runnable/executor workflows | Good for existing LangChain stacks |
| `GoogleADKAdapter` | Your agent runs behind a Google ADK HTTP endpoint | Maps remote event streams into A2A updates |
| `CrewAIAdapter` | Your CrewAI runtime is exposed through a Python bridge | Marked as bridge-oriented and beta |
| `LlamaIndexAdapter` | You use `BaseQueryEngine` or `BaseChatEngine` | Preserves retrieval metadata in artifact metadata |

## Anthropic

```ts
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicAdapter } from 'a2a-mesh-adapters';

const adapter = new AnthropicAdapter(card, new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
adapter.start(3000);
```

## Google ADK

```ts
import { GoogleADKAdapter } from 'a2a-mesh-adapters';

const adapter = new GoogleADKAdapter(card, 'https://adk.example.com/agent', process.env.GOOGLE_API_KEY);
adapter.start(3000);
```

## CrewAI

```ts
import { CrewAIAdapter } from 'a2a-mesh-adapters';

const adapter = new CrewAIAdapter(card, {
  bridgeUrl: 'http://localhost:8001',
  apiKey: process.env.CREWAI_BRIDGE_KEY,
});
adapter.start(3000);
```

## LlamaIndex

```ts
import { LlamaIndexAdapter } from 'a2a-mesh-adapters';

const adapter = new LlamaIndexAdapter(card, chatEngineOrQueryEngine);
adapter.start(3000);
```

## Notes

- Bridge adapters expect the remote runtime to be operational and reachable.
- Provider-specific token or trace metadata is surfaced on artifact metadata whenever available.
- Extension metadata should be passed through task configuration so adapters can enrich artifacts consistently.
