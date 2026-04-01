# Quick Start

```ts
import { BaseAdapter } from 'a2a-mesh-adapters';
import type { Artifact, Message, Task } from 'a2a-mesh';

class EchoAgent extends BaseAdapter {
  async handleTask(_task: Task, message: Message): Promise<Artifact[]> {
    const text = message.parts.find((part) => part.type === 'text');
    return [
      {
        artifactId: 'echo',
        parts: [{ type: 'text', text: text?.type === 'text' ? text.text : 'empty' }],
        index: 0,
        lastChunk: true,
      },
    ];
  }
}
```

## Try it online

<iframe src="https://stackblitz.com/github/oaslananka/a2a-mesh/tree/main/apps/demo?embed=1" width="100%" height="600" />
