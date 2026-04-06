# Agent Packs

The `a2a-mesh` CLI provides pre-configured multi-agent starter packs designed to solve common business workflows instantly.

## `pack-research-team`

The **Research Team** pack comes with three pre-configured agents:

1. **Researcher**: Designed to gather data and fetch context (simulated or real tools).
2. **Analyst**: Processes the data provided by the researcher and identifies key metrics.
3. **Writer**: Takes the analysis and produces a final summarized report.

**Usage:**

```bash
npx create-a2a-mesh research-project --adapter pack-research-team
```

## `pack-support-triage`

The **Support Triage** pack is ideal for customer service routing:

1. **Support Agent**: Greets the user, categorizes the request, and attempts to resolve basic issues.
2. **Tech Specialist**: Escalated queries are passed here for deep technical debugging.

**Usage:**

```bash
npx create-a2a-mesh support-desk --adapter pack-support-triage
```

## Value Proposition

All packs include:

- An embedded `RegistryServer` running on port 3099.
- Automatic registration and discovery hooks.
- Interoperability via the `A2AClient`.
- Full compatibility with the Visual Control Plane UI.
