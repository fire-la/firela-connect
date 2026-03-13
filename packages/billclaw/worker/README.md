# @firela/billclaw-worker

BillClaw Cloudflare Worker - Self-hosted financial data service.

Deploy your own instance of BillClaw to Cloudflare Workers for real-time transaction updates via webhooks.

## Deploy to Cloudflare

Click the button below to deploy BillClaw to your Cloudflare account:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/fire-la/billclaw/tree/main/packages/cloudflare-worker)

### Requirements

- **Cloudflare account** (free tier works)
- **Plaid developer account** (free for sandbox) - [Get one here](https://dashboard.plaid.com/signup)

### After Deployment

1. Go to your Worker in the [Cloudflare dashboard](https://dash.cloudflare.com)
2. Navigate to **Settings > Variables and Secrets**
3. Add the following secrets:

| Secret | Description | How to get |
|--------|-------------|------------|
| `PLAID_CLIENT_ID` | Your Plaid client ID | [Plaid Dashboard](https://dashboard.plaid.com/team/keys) |
| `PLAID_SECRET` | Your Plaid secret key | [Plaid Dashboard](https://dashboard.plaid.com/team/keys) |
| `JWT_SECRET` | Secret for API tokens | Any random 32+ character string |
| `SETUP_PASSWORD` | One-time setup password | Any password you choose |

4. Visit your worker URL to get your API token using the setup password

## Features

- **Plaid Integration**: Connect bank accounts via Plaid Link
- **Transaction Storage**: Automatic storage in Cloudflare D1
- **Webhook Receiver**: Real-time transaction updates
- **JWT Authentication**: Secure API access with long-lived tokens
- **HMAC Verification**: Secure webhook signature validation

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/setup` | Get API token (requires setup password) |

### Plaid OAuth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/oauth/plaid/link-token` | Create Plaid Link token |
| `POST` | `/api/oauth/plaid/exchange` | Exchange public token for access token |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/webhook/plaid` | Receive Plaid webhooks |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check endpoint |

## Local Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Run tests
pnpm test

# Deploy to Cloudflare
pnpm deploy
```

## Configuration

The worker is configured via environment variables and secrets:

| Variable | Required | Description |
|----------|----------|-------------|
| `PLAID_ENV` | No | Plaid environment (default: `sandbox`) |
| `PLAID_CLIENT_ID` | Yes | Plaid client ID |
| `PLAID_SECRET` | Yes | Plaid secret key |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens |
| `SETUP_PASSWORD` | Yes | Password for initial setup |

## Architecture

```
Cloudflare Worker (Hono)
├── D1 Database (transactions, accounts, sync_state)
├── KV Namespace (config, rate limiting)
└── Routes
    ├── /api/setup - Initial authentication
    ├── /api/oauth/plaid/* - Plaid OAuth flow
    └── /api/webhook/plaid - Webhook receiver
```

## Self-Hosted ID Mode

This worker operates in **Self-Hosted ID mode**:

- You use your own Plaid developer account
- Access tokens are stored in your D1 database
- You pay Plaid directly for production usage
- Sandbox mode is free for development

## License

MIT
