# @firela/billclaw-core

Framework-agnostic core business logic for BillClaw financial data import.

## Overview

This package contains all core functionality with zero dependencies on any AI framework (OpenClaw, OpenHands, etc.). It provides:

- **Data Models**: TypeScript types and Zod schemas for financial data
- **Storage**: Transaction storage with JSON/CSV support, file locking, and streaming
- **Sync**: Plaid and Gmail integration for fetching transactions
- **Exporters**: Beancount and Ledger format exporters
- **Security**: Platform keychain integration and audit logging
- **Performance**: TTL-based memory cache and query indexes
- **Runtime Abstractions**: Logger, ConfigProvider, and EventEmitter interfaces

## Installation

```bash
pnpm add @firela/billclaw-core
```

## Quick Start

```typescript
import { Billclaw } from "@firela/billclaw-core";
import { createRuntimeContext } from "./runtime.js";

// Create a runtime context (framework-specific adapter)
const runtime = createRuntimeContext();

// Initialize BillClaw
const billclaw = new Billclaw(runtime);

// Sync transactions from Plaid
const results = await billclaw.syncPlaid();

// Export to Beancount
const transactions = await billclaw.getTransactions("all", 2024, 1);
const beancount = await exportToBeancount(transactions, {
  accountId: "all",
  year: 2024,
  month: 1,
  commodity: "USD",
});
```

## Architecture

### Core Classes

- **`Billclaw`**: Main class for managing financial data operations
- **`TransactionStorage`**: Handles transaction persistence and queries
- **`MemoryCache`**: TTL-based in-memory caching
- **`AuditLogger`**: Security event logging

### Data Sources

- **Plaid**: Bank account and credit card transactions via Plaid API
- **Gmail**: Bill parsing from email using pattern recognition
- **GoCardless**: European bank accounts via open banking (planned)

### Exporters

- **Beancount**: Plain text accounting format export
- **Ledger**: Ledger CLI format export

## API Reference

### Billclaw

```typescript
class Billclaw {
  constructor(context: RuntimeContext)
  
  // Account management
  getAccounts(): Promise<AccountConfig[]>
  
  // Sync operations
  syncPlaid(accountIds?: string[]): Promise<PlaidSyncResult[]>
  syncGmail(accountIds?: string[], days?: number): Promise<GmailFetchResult[]>
  syncDueAccounts(): Promise<any[]>
  
  // Transaction queries
  getTransactions(accountId: string, year: number, month: number): Promise<Transaction[]>
  
  // Export operations
  exportToBeancount(transactions: Transaction[], options: BeancountExportOptions): Promise<string>
  exportToLedger(transactions: Transaction[], options: LedgerExportOptions): Promise<string>
}
```

### Configuration

```typescript
interface BillclawConfig {
  accounts: AccountConfig[];
  webhooks: WebhookConfig[];
  storage: StorageConfig;
  sync: SyncConfig;
  plaid: PlaidConfig;
  gocardless?: GoCardlessConfig;
  gmail?: GmailConfig;
}
```

## License

MIT
