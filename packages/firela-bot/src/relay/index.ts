/**
 * Relay Module
 *
 * Provides client for communicating with relay.firela.io
 */

// Client
export { RelayClient, createRelayClient } from './client';

// Error handling
export { RelayError, getUserErrorMessage } from './errors';

// Types
export type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  RelayErrorResponse,
  RelayClientConfig,
} from './types';
