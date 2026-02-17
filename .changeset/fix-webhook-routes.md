---
"@firela/billclaw-connect": patch
---

Fix webhook route mounting to avoid duplicate path prefixes

The webhook routes were incorrectly mounted with duplicate path prefixes
(e.g., /webhook/plaid/plaid instead of /webhook/plaid). This fix corrects
the route mounting in server.ts to use a single /webhook prefix.

