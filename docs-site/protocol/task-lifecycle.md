# Task Lifecycle

Tasks move through the following states:

- `submitted`
- `working`
- `input-required`
- `completed`
- `failed`
- `canceled`

The `/health` endpoint and `tasks/list` extension expose task counts and stored history by `contextId`.
