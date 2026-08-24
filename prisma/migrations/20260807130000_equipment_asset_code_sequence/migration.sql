-- Phase S4 Equipment · Atomic per-organization asset code generation.
--
-- Closes A-1 (HIGH race condition): `generateAssetCode` previously scanned
-- inventory codes globally across all organizations and computed the next
-- number non-atomically, allowing two concurrent POSTs to assign the same
-- code (one would then collide on the unique index and return 409 to the user).
--
-- This migration adds EQUIPMENT_ASSET_CODE to the DocumentType enum and
-- reuses the existing `document_sequences` table (one row per
-- (organizationId, documentType, year)) for atomic increment via
-- `allocateDocumentSequence` in src/platform/sequences/document-sequence.ts.

-- Step 1: add new enum value (PostgreSQL allows adding values without rewriting the table).
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'EQUIPMENT_ASSET_CODE';

-- The enum value must be committed before it can be used by a data
-- modification in PostgreSQL. The idempotent backfill runs in the following
-- migration, after this migration's transaction has committed.
-- That backfill retains the original MAX(inventoryCode) and ON CONFLICT
-- document_sequences logic, but runs after the enum commit.
