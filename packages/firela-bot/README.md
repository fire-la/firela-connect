# Firela Bot Worker

Firela Bot Discord Worker - self-hosted AI assistant for Firela ecosystem.

Deploy your own instance of Firela Bot to Cloudflare Workers for Discord integration with AI capabilities.

> **Related Project:** This is part of the Firela ecosystem. For financial data fetching, see [billclaw](https://github.com/fire-la/billclaw) which uses the same deployment pattern.

## Table of Contents

- [Creating Your Discord Bot](#creating-your-discord-bot)
- [Deploy to Cloudflare](#deploy-to-cloudflare)
- [After Deployment](#after-deployment)
  - [Step 1: Configure Secrets](#step-1-configure-secrets)
  - [Step 2: Configure Interactions Endpoint URL](#step-2-configure-interactions-endpoint-url)
  - [Step 3: Register Slash Commands](#step-3-register-slash-commands)
  - [Step 4: Test Your Bot](#step-4-test-your-bot)
- [FAQ](#faq)
- [Troubleshooting](#troubleshooting)
- [Self-Hosted Mode](#self-hosted-mode)
- [Local Development](#local-development)

## Creating Your Discord Bot

Before deploying Firela Bot, you need to create a Discord Bot application. Follow these steps:

### Step 1: Access Discord Developer Portal

1. Visit [Discord Developer Portal](https://discord.com/developers/applications)
2. Sign in with your Discord account
3. Click **"New Application"** in the top right corner

<!-- Screenshot: Discord Developer Portal homepage with "New Application" button highlighted -->

### Step 2: Create Application

1. Enter a name for your bot (e.g., "My Firela Bot")
2. Click **"Create"**

<!-- Screenshot: Create Application dialog with name input field -->

### Step 3: Create Bot User

1. Navigate to **"Bot"** in the left sidebar
2. Click **"Add Bot"**
3. Confirm the dialog

<!-- Screenshot: Bot section with "Add Bot" button -->

### Step 4: Get Credentials

You need three pieces of information from this page:

#### Application ID
1. Navigate to **"General Information"** in the left sidebar
2. Copy the **"Application ID"** - this is your `DISCORD_APPLICATION_ID`

<!-- Screenshot: General Information page with Application ID highlighted -->

#### Public Key
1. Still on **"General Information"** page
2. Copy the **"Public Key"** - this is your `DISCORD_PUBLIC_KEY`

<!-- Screenshot: General Information page with Public Key highlighted -->

#### Bot Token
1. Navigate to **"Bot"** in the left sidebar
2. Click **"Reset Token"** (or "View Token" if already created)
3. Copy the token - this is your `DISCORD_BOT_TOKEN`
4. **Important:** Save this token securely - you won't be able to see it again!

<!-- Screenshot: Bot page with Token section highlighted -->

### Step 5: Configure Bot Permissions

1. In the Bot section, scroll to **"Privileged Gateway Intents"**
2. Enable these intents:
   - `MESSAGE CONTENT INTENT` - to read messages
   - `APPLICATION COMMANDS` - to use slash commands
3. Scroll to **"Bot Permissions"**
4. These permissions are recommended:
   - `Send Messages`
   - `Send Messages in Threads`
   - `Embed Links`
   - `Read Message History`
   - `Use Slash Commands`

<!-- Screenshot: Bot permissions section with recommended permissions checked -->

### Step 6: Invite Bot to Server

1. Navigate to **"OAuth2"** in the left sidebar
2. Click **"Add Redirect"** and enter a URL (or use `http://localhost` for testing)
3. Scroll to **"OAuth2 URL Generator"**
4. Select these scopes:
   - `bot` → `applications.commands`
   - `bot` → `bot.messages.create`
5. Copy the generated URL
6. Open the URL in your browser
7. Select your Discord server and authorize the bot

<!-- Screenshot: OAuth2 URL Generator with scopes selected -->

**Congratulations!** Your Discord bot is now created and invited to your server. Now you can deploy Firela Bot.

---

## Deploy to Cloudflare

Click the button below to deploy Firela Bot to your Cloudflare account:

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/fire-la/firela-bot/tree/main/packages/firela-bot/worker)

### Requirements

- **Cloudflare account** (free tier works) - [sign up here](https://dash.cloudflare.com/sign-up)
- **Discord Bot** - you should have created this in the previous section
- **Firela API Key** - get yours from [firela.io/dashboard](https://firela.io/dashboard)

## After Deployment

Follow these steps in order to complete the setup:

### Step 1: Configure Secrets

1. Go to your Worker in the [Cloudflare dashboard](https://dash.cloudflare.com)
2. Navigate to **Settings > Variables and Secrets**
3. Add the following secrets:

| Secret | Description | How to get |
|--------|-------------|------------|
| `DISCORD_PUBLIC_KEY` | Discord application public key | Discord Developer Portal → Your App → General Information → Public Key |
| `DISCORD_BOT_TOKEN` | Discord bot token | Discord Developer Portal → Your App → Bot → Token |
| `DISCORD_APPLICATION_ID` | Discord application ID | Discord Developer Portal → Your App → General Information → Application ID |
| `FIRELA_BOT_API_KEY` | Your Firela Bot API key | [Firela Dashboard](https://firela.io/dashboard) |
| `SETUP_PASSWORD` | Password for one-time setup endpoints | Create a strong password (used for command registration) |

> **Important:** All credentials are case-sensitive. Copy them exactly as shown in the Discord Developer Portal.

### Step 2: Configure Interactions Endpoint URL

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Navigate to your application → **General Information**
3. Find **Interactions Endpoint URL**
4. Enter your Worker URL: `https://<your-worker>.<your-subdomain>.workers.dev/interactions`
5. Click **Save Changes**

> **Note:** Replace `<your-worker>` and `<your-subdomain>` with your actual Worker details from the Cloudflare dashboard.

### Step 3: Register Slash Commands

After configuring the endpoint URL, register the slash commands:

1. Open your browser and visit:
   ```
   https://<your-worker>.<your-subdomain>.workers.dev/api/register-commands?password=<SETUP_PASSWORD>
   ```

2. Replace `<your-worker>` and `<your-subdomain>` with your Worker details
3. Replace `<SETUP_PASSWORD>` with the password you configured in Step 1

4. You should see a success response like:
   ```json
   {
     "success": true,
     "message": "Slash commands registered successfully!",
     "commands": [...],
     "note": "Global commands may take up to 1 hour to appear in Discord."
   }
   ```

> **Note:** Global commands may take up to 1 hour to appear in Discord. For instant testing, consider using guild-specific commands.

### Step 4: Test Your Bot

1. Invite your bot to a Discord server (if not done already during bot creation)
2. In any channel where the bot has access, type `/chat hello`
3. Your bot should respond!

**Congratulations!** Your Firela Bot is now fully deployed and operational.

---

## FAQ

### Deployment

**Q: Deploy Button fails?**

A: Common causes:
- **Invalid repository URL:** Make sure you're using the correct GitHub URL
- **Missing permissions:** Ensure your Cloudflare account has Workers enabled
- **Browser issues:** Try clearing cache or using incognito mode

**Q: How to check deployment logs?**

A:
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to Workers & Pages → Your Worker
3. Click on "Logs" tab
4. Interact with your bot to see real-time logs

### Configuration

**Q: Secrets not working after configuration?**

A:
1. Verify secrets are added to the correct Worker (not a different one)
2. Ensure secret names are exactly as specified (case-sensitive)
3. Wait 1-2 minutes after adding secrets for them to take effect
4. Check Worker logs for any authentication errors

**Q: Interactions URL validation fails?**

A:
1. Ensure your Worker is deployed successfully
2. Verify the URL format: `https://<worker>.<subdomain>.workers.dev/interactions`
3. Check if Worker is accessible (visit the URL in browser)
4. Verify `DISCORD_PUBLIC_KEY` secret is configured correctly

### Usage

**Q: Bot not responding to commands?**

A:
1. Verify slash commands are registered (Step 3)
2. Wait up to 1 hour for global commands to propagate
3. Check Worker logs for errors
4. Ensure bot has proper permissions in the Discord server

**Q: How to view conversation history?**

A: Conversations are stored in your Cloudflare KV. To access:
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to Workers > KV
3. Find your namespace
4. Browse keys to see conversation history

### Account

**Q: How to get Firela API Key?**

A:
1. Visit [Firela Dashboard](https://firela.io/dashboard)
2. Sign in or create an account
3. Navigate to API Keys section
4. Generate a new key

**Q: How to update API Key?**

A:
1. Go to Cloudflare Dashboard → Your Worker → Settings → Variables and Secrets
2. Find `FIRELA_BOT_API_KEY`
3. Click "Edit" and enter new value
4. Save changes (takes effect immediately)

---

## Troubleshooting

### Common Issues

**Worker not responding**
- Check Worker logs in Cloudflare Dashboard
- Verify all secrets are configured
- Ensure Worker is deployed successfully

**Authentication errors**
- Double-check all Discord credentials
- Ensure credentials are case-sensitive
- Regenerate Discord bot token if needed

**Commands not appearing**
- Wait 1 hour for global command propagation
- Check command registration response for errors
- Try re-registering commands

### Getting Help

If you encounter issues not covered in this FAQ:
1. Check the [GitHub Issues](https://github.com/fire-la/firela-bot/issues)
2. Join our [Discord Community](https://discord.gg/firela)
3. Contact support at support@firela.io

---

## Self-Hosted Mode

This worker operates in **self-hosted mode**:

- You use your own Discord bot application
- Conversation history stored in your Cloudflare KV
- Memory stored in your Cloudflare D1 database
- Vector embeddings stored in your Cloudflare Vectorize

Your data stays in your Cloudflare account - Firela does not have access to your conversations or data.

---

## Local Development

For local development:

```bash
# Install dependencies
pnpm install

# Create .dev.vars from example
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your credentials

# Run locally
pnpm dev

# Register commands (optional, for testing)
pnpm register-commands
```

---

## License

MIT
