# Registry UI

The Registry UI is a lightweight browser dashboard for exploring a running
`a2a-mesh` registry.

It is designed for local development, demos, and operator visibility rather
than as a full hosted control plane.

## What it does

- lists registered agents
- filters by name, skill, or tag
- shows the selected agent card JSON
- watches registry updates over SSE
- lets you point the UI at a custom registry URL

## Local development

Start the demo stack first:

```bash
npm run demo:local
```

Then run the UI:

```bash
npm --workspace apps/registry-ui run dev
```

Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

By default, the dashboard expects the registry at `http://localhost:3099`.

## Recommended workflow

Use the Registry UI together with:

- the local demo agents
- `npx a2a registry start` for a standalone registry
- the CLI for validation and task submission

## Current scope

The Registry UI currently focuses on discovery and inspection:

- registry browsing
- live updates
- agent card visibility

It does not yet provide a full hosted management plane, workflow authoring, or
enterprise governance controls.
