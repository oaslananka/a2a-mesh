# Manual Launch Checklist

The following items cannot be fully enforced by git alone and should be completed on the live GitHub repository.

## Repository metadata

- Set description to: `Production-ready TypeScript runtime for Google's Agent2Agent (A2A) Protocol — server, client SDK, multi-framework adapters, registry & CLI.`
- Add topics: `a2a`, `agent2agent`, `ai-agents`, `multi-agent`, `llm-orchestration`, `typescript`, `mcp`, `openai`, `anthropic`, `langchain`, `google-adk`, `crewai`, `llamaindex`, `protocol`, `interoperability`, `nodejs`, `monorepo`, `open-source`
- Set website to `https://oaslananka.github.io/a2a-mesh`
- Upload `.github/og-image.png` as the social preview image

## Community settings

- Enable GitHub Discussions
- Create categories: Announcements, General, Q&A, Ideas, Adapters, Show & Tell
- Configure branch protection for `main` with required review and required CI
- Ensure at least one open issue is labeled `good first issue`

## Security and automation

- Enable private vulnerability reporting
- Configure `CODECOV_TOKEN`, `NPM_TOKEN` and any Azure mirror sync secrets
- Apply Algolia DocSearch once GitHub Pages docs are live
