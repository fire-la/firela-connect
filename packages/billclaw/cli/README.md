# @firela/billclaw-cli

Standalone command-line interface for BillClaw financial data management.

## Overview

The CLI package provides a command-line tool for managing financial data without requiring any AI framework. It includes:

- Interactive setup wizard for connecting accounts
- Manual transaction sync from Plaid and Gmail
- Account status monitoring
- Configuration management
- Export to Beancount and Ledger formats
- Import from CSV, OFX, and QFX files

## Installation

### Global Installation

```bash
npm install -g @firela/billclaw-cli
```

### Local Installation

```bash
npm install @firela/billclaw-cli
npx billclaw
```

## Quick Start

```bash
# Interactive setup wizard
billclaw setup

# Sync all accounts
billclaw sync

# Sync specific account
billclaw sync --account plaid-123

# Show account status
billclaw status

# Export transactions
billclaw export --format beancount --output transactions.beancount
```

## Commands

### setup

Interactive setup wizard for connecting accounts.

```bash
billclaw setup
```

Supports:
- Plaid (bank accounts via Plaid Link)
- Gmail (email bills)
- GoCardless (European open banking)

### sync

Manually trigger transaction sync.

```bash
# Sync all accounts
billclaw sync

# Sync specific account
billclaw sync --account <id>

# Sync all (explicit)
billclaw sync --all
```

### status

Show connection status and recent sync results.

```bash
billclaw status
```

Displays:
- Account ID and type
- Connection status
- Last sync time

### config

Manage plugin configuration.

```bash
# List all configuration
billclaw config --list

# Get specific value
billclaw config --key storage.path

# Set value
billclaw config --key storage.format --value json
```

### export

Export transactions to Beancount or Ledger format.

```bash
# Export to Beancount
billclaw export --format beancount --output transactions.beancount

# Export specific account
billclaw export --account plaid-123 --format ledger

# Export specific period
billclaw export --year 2024 --month 1
```

### import

Import transactions from external files.

```bash
# Import from CSV
billclaw import transactions.csv

# Import from OFX
billclaw import statement.ofx --account checking-123
```

## Configuration

Configuration is stored in `~/.firela/billclaw/config.json`:

```json
{
  "accounts": [],
  "webhooks": [],
  "storage": {
    "path": "~/.firela/billclaw",
    "format": "json",
    "encryption": { "enabled": false }
  },
  "sync": {
    "defaultFrequency": "daily",
    "maxRetries": 3,
    "retryOnFailure": true
  },
  "plaid": {
    "environment": "sandbox"
  }
}
```

## Data Storage

By default, data is stored in `~/.firela/billclaw/`:

```
~/.firela/billclaw/
├── config.json           # Configuration
├── data/                 # Transaction storage
│   ├── transactions/     # Per-account transactions
│   └── accounts/         # Account metadata
└── exports/              # Exported files
```

## Exit Codes

- `0` - Success
- `1` - Error occurred

## Examples

### Complete Workflow

```bash
# 1. Setup accounts
billclaw setup

# 2. Sync transactions
billclaw sync

# 3. Check status
billclaw status

# 4. Export to Beancount
billclaw export --format beancount -o main.beancount
```

### Monthly Accounting Export

```bash
# Export last month's transactions
billclaw export   --format beancount   --year 2024   --month 1   --output january.beancount
```

## License

MIT
