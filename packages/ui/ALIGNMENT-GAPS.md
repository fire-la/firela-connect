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

---

## Critical: toykit → firela-connect Adaptation Gaps

### P0 — Mobile Navigation Completely Broken

**MobileMenuButton NEVER renders on any page.**

Root cause chain:

1. `useHeaderBar.js:72` — `isConsoleRoute = location.pathname.startsWith('/console')` is always false
   - firela-connect routes: `/connect`, `/sync`, `/export` etc (no `/console` prefix)
   - toykit routes: `/console/*` (the check works there)

2. `MobileMenuButton.jsx:13` — `if (!isConsoleRoute || !isMobile) return null` always early-exits

3. `PageLayout.jsx:29` — Local `drawerOpen` state disconnected from SidebarProvider's `openMobile`
   - sidebar.jsx uses Sheet component correctly for mobile
   - but the trigger button never appears to open it

**Impact**: All mobile users see NO navigation — no hamburger menu, no sidebar access.

**Fix**: Remove or adapt `isConsoleRoute` check. Since ALL firela-connect pages have a sidebar, the mobile menu button should always show.

### P1 — UserArea Navigation Links Point to toykit Routes

`headerbar/UserArea.jsx` navigates to non-existent routes:
- `/console/personal` (line 66)
- `/console/token` (line 74)
- `/console/topup` (line 82)

These are toykit-specific features. firela-connect has no such pages.

**Fix**: Remove or adapt UserArea dropdown for firela-connect's actual pages.

### P2 — PageLayout Has Local useIsMobile Copy

`PageLayout.jsx:66-80` defines its own `useIsMobile()` using `window.innerWidth` + resize listener,
while `hooks/common/useIsMobile.js` uses `useSyncExternalStore` + `matchMedia` (correct shadcn pattern).

**Fix**: Import shared `useIsMobile` from hooks.

### P3 — useHeaderBar Depends on Missing Contexts

`useHeaderBar.js` imports:
- `UserContext` from `../../context/User` — not provided in App.tsx
- `StatusContext` from `../../context/Status` — not provided in App.tsx

App.tsx only provides `ServiceStateProvider` and `ThemeProvider`.

The hook works because useSidebar returns safe defaults, but the User/Status context values are undefined,
making logout, notifications, and theme features unreliable.

**Fix**: Create adapter contexts or refactor useHeaderBar to use ServiceStateContext.

---

## Notes

- Phase 13.3.1 focused on fixing critical sync status display
- Higher priority items affect core user workflows
- Lower priority items are nice-to-have features
- All gaps should be evaluated during milestone planning for prioritization
