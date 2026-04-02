# @firela/billclaw-ui

Unified configuration UI for BillClaw - A React + Vite + Tailwind single-page application for managing financial data synchronization settings.

## Usage

### Development

```bash
cd packages/ui
pnpm dev
```

Starts the development server using `wrangler dev` at `http://localhost:8787`.

### Build

```bash
pnpm build
```

Builds the production bundle to `dist/`.

### CLI

The UI is served via the `billclaw ui` command from the CLI package:

```bash
billclaw ui [--port 8787] [--no-open]
```

Options:
- `--port <number>` - Server port (default: 8787)
- `--no-open` - Don't open browser automatically

## Architecture

### UIAdapter Pattern

The UIAdapter interface enables the same UI codebase to work in multiple environments:

- **BrowserAdapter**: Uses `fetch` API for HTTP communication with backend services
- _(Future)_ **CLIAdapter**: Direct function calls to core
- _(Future)_ **OpenClawAdapter**: Integration with OpenClaw runtime

```typescript
interface UIAdapter {
  getConfig(): Promise<BillclawConfig>
  updateConfig(config: Partial<BillclawConfig>): Promise<void>
  listAccounts(): Promise<Account[]>
  connectAccount(provider: 'plaid' | 'gmail'): Promise<{ url: string }>
  disconnectAccount(accountId: string): Promise<void>
  syncAccount(accountId: string): Promise<SyncResult>
  getSyncStatus(): Promise<SyncStatus>
  getSystemStatus(): Promise<SystemStatus>
}
```

### Configuration Pages

The UI provides configuration pages for:

| Page | Route | Description |
|------|-------|-------------|
| Connect | `/` | Manage Plaid and Gmail connections |
| Sync | `/sync` | Configure synchronization settings |
| Export | `/export` | Set up Beancount/Ledger export |
| VLT | `/vlt` | Configure Firela VLT integration |
| Webhook | `/webhook` | Manage webhook settings |
| Advanced | `/advanced` | Advanced options |

### State Management

Uses Zustand for global state:

- **configStore**: Configuration and account state
- **uiStore**: UI-specific state (theme, sidebar)

## Tech Stack

| Component | Library | Version |
|-----------|---------|---------|
| Framework | React | ^18.2.0 |
| Build | Vite | ^5.2.0 |
| Routing | React Router DOM | ^6.3.0 |
| UI Components | Radix UI | ^1.4.3 |
| Styling | Tailwind CSS | ^3.4.0 |
| Forms | React Hook Form + Zod | ^7.71.2 |
| HTTP | Axios | ^1.12.0 |
| Icons | Lucide React | ^0.511.0 |
| i18n | i18next | ^23.16.8 |
| State | Zustand | ^4.4.7 |

## Internationalization

The UI supports multiple languages with automatic browser detection.

### Supported Languages

- **English** (`en`) - Default fallback
- **Chinese** (`zh`)

### Adding New Translations

1. Create a new translation file in `src/i18n/`:
   ```bash
   # Example: Adding Japanese
   echo '{}' > src/i18n/ja.json
   ```

2. Add translations following the structure in `en.json`

3. Register the language in `src/i18n/index.ts`:
   ```typescript
   import ja from './ja.json'

   i18n.init({
     resources: {
       en: { translation: en },
       zh: { translation: zh },
       ja: { translation: ja },  // Add this
     },
     // ...
   })
   ```

### Using Translations in Components

```tsx
import { useTranslation } from 'react-i18next'

function MyComponent() {
  const { t } = useTranslation()

  return <h1>{t('connect.title')}</h1>
}
```

## Testing

### Run Unit Tests

```bash
pnpm test
```

### Watch Mode

```bash
pnpm test:watch
```

### Test Coverage

```bash
pnpm test -- --coverage
```

## Project Structure

```
packages/ui/
├── src/
│   ├── adapters/          # Environment adapters
│   │   ├── types.ts       # UIAdapter interface
│   │   ├── browser.ts     # Browser implementation
│   │   └── index.ts       # Adapter factory
│   ├── components/        # React components
│   │   ├── ui/            # Base UI components
│   │   ├── layout/        # Layout components
│   │   └── pages/         # Page components
│   ├── hooks/             # Custom React hooks
│   ├── i18n/              # Translations
│   │   ├── index.ts       # i18next configuration
│   │   ├── en.json        # English
│   │   └── zh.json        # Chinese
│   ├── lib/               # Utility functions
│   ├── stores/            # Zustand stores
│   ├── styles/            # Global styles
│   ├── App.tsx            # Root component
│   ├── main.tsx           # Entry point
│   └── index.css          # Global CSS
├── public/                # Static assets
├── index.html             # HTML template
├── vite.config.ts         # Vite configuration
├── vitest.config.ts       # Test configuration
└── package.json
```

## License

MIT
