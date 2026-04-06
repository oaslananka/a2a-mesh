# CrewAI Adapter

`CrewAIAdapter` is an **HTTP bridge** for CrewAI Python services.

Since CrewAI is a Python framework, the adapter does not import it directly. Instead, it calls a
running CrewAI HTTP service and normalizes the response into the standard A2A artifact format.

## How it works

```text
TypeScript A2A Server
    │
    ▼
CrewAIAdapter.handleTask()
    │  POST /  (JSON: taskId, contextId, message, history)
    ▼
CrewAI Python HTTP service
    │
    ▼
{ output: string, metadata: {} }
```

## Usage

```ts
import { CrewAIAdapter } from 'a2a-mesh-adapters';
import type { AgentCard } from 'a2a-mesh';

const card: AgentCard = {
  protocolVersion: '1.0',
  name: 'CrewAI Bridge Agent',
  description: 'Delegates tasks to a CrewAI service',
  url: 'http://localhost:3001',
  version: '1.0.0',
};

class MyCrewAgent extends CrewAIAdapter {
  constructor() {
    super(card, 'http://localhost:8080');
  }
}
```

## Running the Python side

Your CrewAI service needs a single `POST /` endpoint:

```python
from flask import Flask, request, jsonify
from crewai import Crew

app = Flask(__name__)

@app.route("/", methods=["POST"])
def run():
    body = request.json
    result = my_crew.kickoff(inputs={"query": body["message"]})
    return jsonify({"output": str(result)})

app.run(port=8080)
```

## Status

`@beta` — the transport contract is stable enough for experimentation, but may evolve before the
next major adapter release.
