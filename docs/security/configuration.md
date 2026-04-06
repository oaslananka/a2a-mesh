# Configuration Security

This document details secure configuration practices when building and deploying `a2a-mesh` agents.

## Managing Secrets

Never hardcode secrets (like API keys or tokens) directly into your source code. The `a2a-mesh` tools enforce this best practice.

**Scaffolded Projects:**
When using `a2a scaffold`, the generator creates a `.env.example` file instead of injecting dummy secrets like `dev-secret` directly into the agent configuration.

**Example `.env.example`:**

```env
OPENAI_API_KEY=
A2A_API_KEY=your-secure-api-key-here
```

**Runtime Loading:**
In your agent code, always load secrets via environment variables (e.g., `process.env.A2A_API_KEY`). Ensure your deployment environment (e.g., Docker, Render, Kubernetes) injects these secrets securely at runtime.
