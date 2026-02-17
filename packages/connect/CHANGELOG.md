# @firela/billclaw-connect

## 0.5.5

### Patch Changes

- b2743b0: Fix webhook route mounting to avoid duplicate path prefixes

  The webhook routes were incorrectly mounted with duplicate path prefixes
  (e.g., /webhook/plaid/plaid instead of /webhook/plaid). This fix corrects
  the route mounting in server.ts to use a single /webhook prefix.

## 0.5.4

### Patch Changes

- Fix SKILL.md inconsistencies for OpenClaw security compliance.

  **Problem**: Security scan flagged two inconsistencies:

  1. Package name mismatch between SKILL.md and registry metadata
  2. Contradictory "No external code execution" statement

  **Changes**:

  1. Add @firela/billclaw-openclaw as primary (required) install entry
  2. Update Security Guarantee to clarify:
     - Skill provides installation instructions
     - Code execution handled by installed npm packages
     - All packages are transparent and auditable
  3. Add Package Overview section labeling required vs optional

  **Metadata updates**:

  - install[0]: @firela/billclaw-openclaw (required)
  - install[1]: @firela/billclaw-cli (optional)
  - install[2]: @firela/billclaw-connect (optional)

- Updated dependencies
  - @firela/billclaw-core@0.5.4

## 0.5.3

### Patch Changes

- Fix SKILL.md metadata format to match OpenClaw official standard.

  Change metadata from single-line JSON string to multi-line YAML
  nested JSON object format. This fixes ClawHub registry parsing issues
  where metadata (requires.env, install specs) was not properly recognized.

  **Before (single-line JSON):**

  ```yaml
  metadata: { "openclaw": { "requires": { "env": [...] } } }
  ```

  **After (multi-line YAML nested JSON):**

  ```yaml
  homepage: https://github.com/fire-la/billclaw
  metadata:
    {
      "openclaw":
        {
          "emoji": "💰",
          "requires": { "env": [...], "anyBins": [...] },
          "primaryEnv": "PLAID_CLIENT_ID",
          "install": [...],
        },
    }
  ```

  This matches the format used by official OpenClaw skills and ensures
  proper parsing by ClawHub registry.

- Updated dependencies
  - @firela/billclaw-core@0.5.3

## 0.5.2

### Patch Changes

- SKILL.md security optimization for VirusTotal compliance:
  - Add prominent Security Guarantee section
  - Remove direct npm install commands (use metadata instead)
  - Emphasize all packages are verified npm packages
  - Reference documentation for detailed setup
  - Clarify skill is documentation-only
- Updated dependencies
  - @firela/billclaw-core@0.5.2

## 0.5.1

### Patch Changes

- Version bump to 0.5.1 for ClawHub security compliance release
- Updated dependencies
  - @firela/billclaw-core@0.5.1

## 0.5.0

### Minor Changes

- 0080d71: Add OpenClaw skill metadata for ClawHub security compliance:
  - Declare required credentials (PLAID_CLIENT_ID, PLAID_SECRET, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET)
  - Set disable-model-invocation for sensitive financial data handling
  - Add optional install specs for CLI and Connect components
  - Update documentation to clarify plugin-based architecture

### Patch Changes

- 1bf6e7d: Version bump to 0.5.1
- Updated dependencies [1bf6e7d]
- Updated dependencies [0080d71]
  - @firela/billclaw-core@0.5.0

## 0.4.0

### Minor Changes

- e871be0: Add security declaration and clarify installation for OpenClaw users:

  - Add Security & Privacy section with keychain storage explanation
  - Add Credential Storage Summary table
  - Split Installation into OpenClaw and CLI sections
  - Clarify OpenClaw users don't need external npm packages
  - Add Security Disclosure section with vulnerability reporting

  This addresses the 'Suspicious' security scan label by providing
  transparency about security architecture and data handling practices.

### Patch Changes

- Updated dependencies [e871be0]
  - @firela/billclaw-core@0.4.0

## 0.3.0

### Minor Changes

- 7ca5691: Add AI-friendly error handling with dual-mode output optimized for AI agents

  - Enhanced UserError interface with machine-readable fields (errorCode, severity, recoverable, nextActions, entities)
  - Added ERROR_CODES constant with 30+ error codes for programmatic handling
  - Updated all Result interfaces to use UserError[] instead of string[]
  - Implemented dual-mode output in OpenClaw tools (machine-readable + human-readable)
  - Added exponential backoff retry for Plaid API calls (retryPlaidCall)
  - Updated all error parsers (parsePlaidError, parseGmailError, parseNetworkError, parseFileSystemError)
  - Added formatError() utility for CLI display

### Patch Changes

- Updated dependencies [7ca5691]
  - @firela/billclaw-core@0.3.0

## 0.2.0

### Minor Changes

- f46be36: Add BillClaw Connect OAuth server and webhook support

### Patch Changes

- Updated dependencies [f46be36]
  - @firela/billclaw-core@0.2.0
