# create-a2a-mesh

`create-a2a-mesh` bootstraps a new `a2a-mesh` project with the same scaffold engine used by the `a2a` CLI.

## Usage

```bash
npx create-a2a-mesh my-research-agent
```

The wrapper forwards all arguments to:

```bash
npx a2a scaffold my-research-agent
```

## Supported flags

```bash
npx create-a2a-mesh my-agent --adapter openai --auth --rate-limit --docker
```

- `--adapter <custom|openai|anthropic|langchain>`
- `--auth`
- `--rate-limit`
- `--docker`
- `--package-manager <npm|pnpm|yarn>`

## Output

The generated project includes:

- `src/agent.ts`
- `src/index.ts`
- `package.json`
- `tsconfig.json`
- `.env.example`
- `README.md`
- optional `Dockerfile`
