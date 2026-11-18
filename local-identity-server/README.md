# Local identity server

A local stand-in for Mailspring's identity server (`id.getmailspring.com`). It handles sign-in,
`/api/me` and plugin metadata storage, which is enough for Snooze, Send Later and Follow-up
reminders to run with no usage limits. Requires Node 22.13+; no dependencies.

## Run

```bash
cd local-identity-server && npm start   # http://127.0.0.1:5101, data in ./data/
```

Then point the dev app at it:

1. Quit Mailspring.
2. In `~/Library/Application Support/Mailspring-dev/config.json` (macOS), set `"env": "development"`
   and `"identity": null` under `"*"`.
3. Start Mailspring and sign in from **Preferences > Subscription > Setup Mailspring ID**.
4. Quit and restart Mailspring. The app hands the sign-in to the sync engine only when it
   starts the engine, so metadata doesn't sync until the restart.

To go back, set `"env": "production"` and sign in to Mailspring ID again.

## Settings

| Variable        | Default                  | Effect                                         |
| --------------- | ------------------------ | ---------------------------------------------- |
| `PORT`          | `5101`                   | The app only looks at 5101 in development      |
| `HOST`          | `127.0.0.1`              | Keep it local; tokens are sent in clear        |
| `DB_PATH`       | `data/local-identity.db` | SQLite file                                    |
| `FEATURE_QUOTA` | `0`                      | Monthly uses per feature; 0 means no limit     |

## Endpoints

| Method and path                            | Purpose                                   |
| ------------------------------------------ | ----------------------------------------- |
| `GET/POST /onboarding`                     | Sign-in form; returns `#identity-result`  |
| `GET /api/me`                              | Identity and feature usage                |
| `POST /api/login-link`                     | Echoes `next_path`                        |
| `POST /api/feature_usage_event`            | Counts one use                            |
| `GET /metadata/:aid`                       | Pages of stored records                   |
| `POST /metadata/:aid/:objectId/:pluginId`  | Saves one record (higher `version` wins)  |
| `GET /deltas/:aid/head`                    | Newest cursor                             |
| `GET /deltas/:aid/streaming`               | Live newline-delimited deltas             |
| `POST /api/resolve-dav-hosts`              | Returns `{}` (no known DAV hosts)         |

Return 401/403 only for a bad token: the sync engine treats both as permanent and aborts.
