# Push Notifications

Clients can register webhook destinations with `tasks/pushNotification/set`. `a2a-mesh` supports:

- plain webhook delivery
- bearer-token auth
- API-key query or header auth
- retry with exponential backoff
