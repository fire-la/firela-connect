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

### Medium Priority

- [ ] **Transaction viewer UI**
  - **Issue**: No backend API to fetch transactions
  - **Impact**: Users cannot view downloaded transactions in UI
  - **Recommended Action**: Add `GET /api/transactions` endpoint with filtering

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

## Notes

- Phase 13.3.1 focused on fixing critical sync status display
- Higher priority items affect core user workflows
- Lower priority items are nice-to-have features
- All gaps should be evaluated during milestone planning for prioritization
