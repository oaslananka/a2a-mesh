# Extensions

## Declaring support

Agents declare supported extensions on the card:

```ts
extensions: [
  { uri: 'https://example.com/extensions/citations/v1', version: '1.0.0' },
]
```

## Requesting extensions

Clients request extensions through `message/send` or `message/stream` configuration:

```ts
configuration: {
  extensions: [
    { uri: 'https://example.com/extensions/citations/v1', required: true },
  ],
}
```

## Negotiation rules

- Supported extensions are applied to the task.
- Unsupported optional extensions are dropped silently.
- Unsupported required extensions return a JSON-RPC error.
- Applied extension URIs are echoed into artifact metadata.

## Metadata guidance

Use artifact metadata to carry extension-specific structured data without breaking default clients.

Good examples:

- citation sources
- retrieval scores
- provider token usage
- trace or audit handles

## Designing custom extensions

- Use stable, absolute URIs.
- Version with the URI or an explicit `version` field.
- Prefer additive metadata over replacing standard task fields.
- Keep non-supporting clients functional through graceful degradation.
