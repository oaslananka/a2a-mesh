# Control Plane UI

This document describes the visual Control Plane included with `a2a-mesh` (found under `apps/registry-ui`).

## Features

The Control Plane transforms the agent registry into an interactive dashboard, bringing true observability to your distributed agent workflows:

1. **Agent Catalog**
   - View all registered agents with their capabilities, skills, and protocols highlighted.
   - Filter instantly by name, tag, or capability (e.g., "MCP Ready").
   - View real-time health statuses, including consecutive failure warnings for degraded agents.

2. **Live Topology**
   - A visual node map that shows all agents currently alive in the mesh network.

3. **Agent Inspector & Live Streams**
   - Click on any agent to inspect its canonical JSON Agent Card.
   - Connect directly to an agent's `SSEStreamer` by providing a Task ID to see real-time execution logs, partial generation chunks, and state transitions without opening a separate terminal.
