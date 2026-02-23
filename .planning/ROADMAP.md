# Roadmap: BillClaw

## Overview

This roadmap addresses technical debt reduction and reliability improvements for BillClaw's connect package. The journey progresses from foundational dependency unification, through code cleanup and test coverage, culminating in robust Relay WebSocket reconnection.

## Domain Expertise

None

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Dependency Unification** - Unify connect package dependency versions
- [ ] **Phase 2: Code Deduplication** - Eliminate duplicate code across packages
- [ ] **Phase 3: Test Coverage** - Increase test coverage for critical paths
- [ ] **Phase 4: Relay Reconnection** - Improve Relay WebSocket reconnection mechanism

## Phase Details

### Phase 1: Dependency Unification
**Goal**: Unify connect package dependency versions with core (TypeScript 5.3.3→5.8.0, Vitest 1.1.0→3.0.0)
**Depends on**: Nothing (first phase)
**Research**: Unlikely (version bumps, established patterns)
**Plans**: 2 plans

Plans:
- [ ] 01-01: Update TypeScript from 5.3.3 to 5.8.0
- [ ] 01-02: Update Vitest from 1.1.0 to 3.0.0

### Phase 2: Code Deduplication
**Goal**: Eliminate duplicate code (formatUserCode, RELAY_URL hardcoded in 25+ locations)
**Depends on**: Phase 1
**Research**: Unlikely (internal refactoring, patterns exist)
**Plans**: 2 plans

Plans:
- [ ] 02-01: Centralize formatUserCode utility
- [ ] 02-02: Centralize RELAY_URL configuration

### Phase 3: Test Coverage
**Goal**: Increase test coverage for critical paths (CLI: 8.7%→80%, connect: 20%→80%)
**Depends on**: Phase 2
**Research**: Unlikely (internal testing, established patterns)
**Plans**: 3 plans

Plans:
- [ ] 03-01: Add CLI command tests
- [ ] 03-02: Add connect package route tests
- [ ] 03-03: Add integration tests for critical paths

### Phase 4: Relay Reconnection
**Goal**: Improve Relay WebSocket reconnection mechanism (exponential backoff, state recovery)
**Depends on**: Phase 3
**Research**: Likely (WebSocket patterns, external best practices)
**Research topics**: WebSocket reconnection patterns, exponential backoff algorithms, state recovery strategies
**Plans**: 2 plans

Plans:
- [ ] 04-01: Implement exponential backoff for WebSocket reconnection
- [ ] 04-02: Add state recovery on reconnection

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Dependency Unification | 0/2 | Not started | - |
| 2. Code Deduplication | 0/2 | Not started | - |
| 3. Test Coverage | 0/3 | Not started | - |
| 4. Relay Reconnection | 0/2 | Not started | - |
