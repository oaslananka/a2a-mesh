# Introduction

In April 2025, Google introduced the **Agent-to-Agent (A2A) Protocol** — an open standard that
defines how AI agents discover each other, delegate tasks, stream results, and confirm completion
over HTTP.

The protocol spec is elegant. Building on top of it is not.

You still need an HTTP server with JSON-RPC routing, SSE streaming, task lifecycle management,
auth middleware, push notifications, telemetry, and registry discovery before you can write a
single line of useful agent logic.

**`a2a-mesh` is that infrastructure.** It implements A2A Protocol v1.0 in a production-grade
TypeScript runtime, then layers adapters, discovery, testing, and control-plane tooling on top so
you can ship interoperable agents in minutes instead of weeks.

## What a2a-mesh is not

- It is not an AI framework. Your model provider and framework choices still belong to you.
- It is not a hosted service. You run it in your own infrastructure.
- It is not opinionated about your agent logic. You provide the task behavior, `a2a-mesh` handles the protocol runtime.

## What you get

- Protocol-correct agent cards, JSON-RPC handling, and SSE task streaming
- Registry-driven discovery and capability matching across multiple agents
- Adapter surfaces for OpenAI, Anthropic, LangChain, Google ADK, CrewAI, and LlamaIndex
- Built-in security and operations primitives such as rate limiting, SSRF protection, retries, and tracing
