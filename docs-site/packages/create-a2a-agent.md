# create-a2a-mesh

`create-a2a-mesh` is the fastest way to start a new `a2a-mesh` project from the command line.

## Usage

```bash
npx create-a2a-mesh my-agent
```

The package forwards into the same scaffold engine used by the `a2a` CLI, so generated projects stay aligned with the current templates and adapter presets.

## Common flags

```bash
npx create-a2a-mesh my-agent --adapter openai --auth --rate-limit --docker
```

- `--adapter <custom|openai|anthropic|langchain>`
- `--auth`
- `--rate-limit`
- `--docker`
- `--package-manager <npm|pnpm|yarn>`
