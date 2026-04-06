# Auth with Next.js

Protect agent endpoints behind a Next.js route handler or reverse proxy when you need browser-originated traffic to carry API keys or bearer tokens.

Typical flow:

1. Store the A2A credential in server-side environment variables.
2. Mint or forward the credential in a Next.js route handler.
3. Call the agent from the browser through your own backend.

This keeps secrets off the client and still allows GitHub- or OIDC-backed session logic to gate access.
