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
  type PKCEPair,
  type CodeChallengeMethod,
} from "./pkce.js"

// Plaid
export {
  createLinkToken,
  exchangePublicToken,
  plaidOAuthHandler,
} from "./providers/plaid.js"

// Generic relay (provider-agnostic OAuth via firela-relay)
export {
  initiateRelayAuth,
  retrieveRelayCredential,
  refreshTokenViaRelay,
} from "./providers/relay.js"

// Gmail (relay wrappers delegating to generic relay + direct OAuth for UI/Workers)
export {
  initiateGmailRelayAuth,
  retrieveGmailRelayCredential,
  refreshGmailTokenViaRelay,
  gmailOAuthHandler,
  refreshGmailToken,
} from "./providers/gmail.js"
