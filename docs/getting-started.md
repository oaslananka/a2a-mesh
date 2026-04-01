# Getting Started

## Prerequisites

- Node.js 20 or newer
- npm workspaces enabled through the repository root
- An A2A-compatible agent URL for local testing

## Install and build

```bash
npm install
npm run build
```

## Start a local agent

Create an agent using `BaseAdapter` from `a2a-mesh-adapters` and expose it on port `3000`.

```ts
import { BaseAdapter } from 'a2a-mesh-adapters';
import type { Artifact, Message, Task } from 'a2a-mesh';

class HelloAgent extends BaseAdapter {
  async handleTask(_task: Task, message: Message): Promise<Artifact[]> {
    const text = message.parts.find((part) => part.type === 'text');
    return [
      {
        artifactId: 'hello-1',
        parts: [{ type: 'text', text: `Hello: ${text?.type === 'text' ? text.text : 'empty'}` }],
        index: 0,
        lastChunk: true,
      },
    ];
  }
}
```

## Discover the agent

```bash
npx a2a discover http://localhost:3000
```

This fetches `/.well-known/agent-card.json` and prints the normalized agent card.

## Send a task

```bash
npx a2a task send http://localhost:3000 "Summarize the latest meeting"
```

Use streaming when you want live state changes:

```bash
npx a2a task stream http://localhost:3000 "Show work in progress"
```

## Register agents locally

```bash
npx a2a registry start --port 3099
npx a2a registry list --url http://localhost:3099
```

## Recommended verification

```bash
npm run lint
npm run typecheck
npm run test -- --coverage
```
