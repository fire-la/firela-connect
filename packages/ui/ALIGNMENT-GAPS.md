# UI-Backend Alignment Gaps

This document tracks gaps between the UI frontend expectations and backend API implementation.

## Fixed in Phase 13.3.1

- [x] **GET /api/sync/status** - Endpoint for displaying sync status
  - Added in `packages/ui/src/server/routes/sync.ts`
  - Returns sync status for all connected accounts
  - Response format matches `UIAdapter.SyncStatus` interface

## By Design (Not Issues)

These are intentional design decisions, not alignment gaps:

### Connection Modes
- **Only `auto`, `direct`, `polling` modes available**
  - `relay` mode was removed in previous architecture refactoring
  - File: `packages/ui/src/server/routes/config.ts:426`

### Sync Trigger
- **Sync is triggered by CLI/Workers only, not from UI**
  - The UI does not have a "trigger sync" button
  - Sync operations are scheduled or manually triggered via CLI
  - This is by design - UI only displays sync status

### Export Functionality
- **Export is test endpoint only**
  - File: `packages/ui/src/server/routes/config.ts:292`
  - Cloudflare Workers cannot access file system
  - Export functionality requires local CLI execution

## Deferred to Future Phases

### High Priority

- [x] **Gmail token refresh flow** — **COMPLETED in Phase 13.3.3**
  - **Fixed**: Added `POST /api/oauth/gmail/refresh` endpoint
  - **Implementation**: `packages/ui/src/server/routes/oauth/gmail.ts`
  - **UI Support**: Added `refreshGmailToken` method to `UIAdapter` interface and `BrowserAdapter`

- [x] **Account update API (PUT /api/accounts/:id)** — **COMPLETED in Phase 13.3.3**
  - **Fixed**: Added `PUT /api/accounts/:id` endpoint
  - **Implementation**: `packages/ui/src/server/routes/accounts.ts`
  - **UI Support**: Added `updateAccount` method to `UIAdapter` interface and `BrowserAdapter`

## Won't Fix

These features are intentionally excluded from the UI:

### Transaction viewer UI
- **Issue**: No backend API to fetch transactions
- **Reason**: Transaction data is stored locally and intended for export to Beancount/Ledger formats, not for viewing in UI
- **Alternative**: Users can view transactions in their accounting software after export

### Medium Priority

- [ ] **Firela Bot management UI**
  - **Issue**: Only toggle exists, no detailed management
  - **Impact**: Limited control over bot behavior
  - **Recommended Action**: Add bot configuration and status endpoints

### Low Priority

- [ ] **Batch account operations**
  - **Issue**: No bulk enable/disable for accounts
  - **Impact**: Manual operations for each account
  - **Recommended Action**: Add `POST /api/accounts/batch` endpoint

- [ ] **Sync history/log viewer**
  - **Issue**: No endpoint to retrieve sync operation history
  - **Impact**: Limited debugging capability
  - **Recommended Action**: Add `GET /api/sync/history` endpoint

## Component Library Alignment (toykit/user-ui sync)

| Item | Status | Notes |
|------|--------|-------|
| CSS design tokens | Synced | index.css identical to toykit/user-ui |
| Tailwind config | Synced | tailwind.config.js identical |
| lib/utils (cn) | Synced | Identical |
| shadcn/ui base components (37) | Synced | All components from toykit/user-ui |
| Layout components (15) | Synced | Props-based API adaptation |
| Switch component import | Migrated 2026-04-06 | From `@radix-ui/react-switch` to unified `radix-ui` package |
| lucide-react | Upgraded 2026-04-06 | `^0.511.0` → `^0.577.0` matching toykit |
| `@radix-ui/react-switch` | Removed 2026-04-06 | All radix-ui components now use unified package |

## Notes

- Phase 13.3.1 focused on fixing critical sync status display
- Higher priority items affect core user workflows
- Lower priority items are nice-to-have features
- All gaps should be evaluated during milestone planning for prioritization
