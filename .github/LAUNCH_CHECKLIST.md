# Repository Checklist

The following items may need manual setup on the public repository surface when one is used.

## Repository metadata

- Set description to: `Production-ready TypeScript runtime for Google's Agent2Agent (A2A) Protocol — server, client SDK, multi-framework adapters, registry & CLI.`
- Add topics: `a2a`, `agent2agent`, `ai-agents`, `multi-agent`, `llm-orchestration`, `typescript`, `mcp`, `openai`, `anthropic`, `langchain`, `google-adk`, `crewai`, `llamaindex`, `protocol`, `interoperability`, `nodejs`, `monorepo`, `open-source`
- Upload `.github/og-image.png` as the social preview image

## Community settings

- Enable GitHub Discussions
- Create categories: Announcements, General, Q&A, Ideas, Adapters, Show & Tell
- Configure branch protection for `main` with required review
- Ensure at least one open issue is labeled `good first issue`

## Security and automation

- Enable private vulnerability reporting
- Configure only the repository secrets that are still used by manual workflows
- If publishing public docs from another host, update repository website and social metadata accordingly
