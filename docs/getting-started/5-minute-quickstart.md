# 5-Minute Quickstart

This guide takes you from a fresh project to a running multi-agent workflow with a local control plane in a few minutes.

## 1. Install the CLI

Ensure you have Node.js 20+ installed.

```bash
npx create-a2a-mesh my-research-team
```

## 2. Choose the Starter Pack

When prompted, select the `pack-research-team` template. This scaffolds a monorepo-style project with:

- An Embedded A2A Registry
- A **Researcher Agent**
- An **Analyst Agent**
- A **Writer Agent**

## 3. Add your Keys

Navigate into the folder and update the `.env` file:

```bash
cd my-research-team
mv .env.example .env
# Edit .env and insert your OPENAI_API_KEY
```

## 4. Run the Mesh

```bash
npm install
# Start the agents in the background
npm run dev &
```

You should see all three agents start and register with the local registry.

## 5. View the Control Plane

If you have the `registry-ui` available:

```bash
cd apps/registry-ui
npm install
npx vite &
```

Open `http://localhost:5173` to inspect the topology view. Select the Writer agent and attach to its live stream to observe task output as it is produced.
