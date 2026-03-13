/**
 * Memory Module
 *
 * Provides long-term memory storage using D1 and Vectorize.
 */

// Types
export type { MemoryEntry } from './types';
export { MEMORY_SCHEMA } from './types';

// D1 Storage
export {
  storeMemory,
  getRecentMemories,
  searchMemories,
  touchMemory,
  deleteOldMemories,
} from './d1';

// Memory Extraction
export {
  shouldStoreMemory,
  extractAndStoreMemory,
} from './extraction';
