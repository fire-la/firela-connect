/**
 * Framework-agnostic OAuth module
 *
 * This module provides OAuth handlers for various financial data providers.
 * All handlers are independent of any specific runtime framework.
 *
 * @packageDocumentation
 */

// Types
export type {
  PlaidConfig,
  GmailOAuthConfig,
  OAuthConfig,
  PlaidLinkTokenResult,
  PlaidTokenExchangeResult,
  PlaidOAuthResult,
  GmailAuthUrlResult,
  GmailTokenResult,
  GmailOAuthResult,
  OAuthContext,
  OAuthHandlerOptions,
} from "./types.js"

// PKCE utilities (RFC 7636)
export {
  generateCodeVerifier,
  generateCodeChallenge,
  generatePKCEPair,
  verifyPKCE,
  initConnectSession,
  retrieveCredential,
  confirmCredentialDeletion,
  type PKCEPair,
  type CodeChallengeMethod,
  type InitSessionRequest,
  type InitSessionResponse,
  type RetrieveCredentialRequest,
  type RetrieveCredentialResponse,
} from "./pkce.js"

// Plaid
export {
  createLinkToken,
  exchangePublicToken,
  plaidOAuthHandler,
} from "./providers/plaid.js"

// Gmail
export {
  cleanupExpiredStates,
  generateAuthorizationUrl,
  exchangeCodeForToken,
  gmailOAuthHandler,
  refreshGmailToken,
} from "./providers/gmail.js"
