# Background Runs & Long-Running Jobs

In traditional HTTP models, connections timeout after a short period (typically 30s to 60s). `a2a-mesh` supports tasks that can take minutes or even hours to complete using background states and the A2A `getTask` polling mechanism.

## State Machine

Tasks flow through the following states in a background job scenario:

1. `submitted`: The task is acknowledged by the server but hasn't started processing.
2. `queued`: The task is waiting in a local or distributed queue for concurrency limits to free up.
3. `working`: The task is actively being processed by the AI model or a tool.
4. `waiting_on_external`: The task is paused, waiting for a webhook, an external system callback, or Human-in-the-loop (HITL) approval.
5. `completed` / `failed` / `canceled`: Terminal states.

## Handling in UI

In the `Control Plane` UI, users can resume streaming or inspecting tasks simply by providing the `taskId`. Because the `A2AServer` holds state (either in-memory or SQLite), users do not need to keep their browser tab open during a 10-minute code generation task. They can close the tab, come back later, paste the `taskId` into the Inspector, and see the final result.
