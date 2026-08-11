-- Phase 8A: notification foundation.
-- Adds the Notification and NotificationDelivery models, the channels and status
-- enums, and the indices required to keep the inbox tenant- and user-scoped.
-- No email transport is configured yet: the EMAIL channel writes a PENDING
-- notification that will be picked up by the Phase 8D provider job.

CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "notifications" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT,
  "eventType" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "actionUrl" TEXT,
  "metadata" JSONB,
  "idempotencyKey" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_deliveries" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "destination" TEXT,
  "provider" TEXT,
  "status" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "providerId" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notifications_organizationId_idempotencyKey_key"
  ON "notifications"("organizationId", "idempotencyKey");

CREATE INDEX "notifications_organizationId_userId_createdAt_idx"
  ON "notifications"("organizationId", "userId", "createdAt" DESC);

CREATE INDEX "notifications_organizationId_status_createdAt_idx"
  ON "notifications"("organizationId", "status", "createdAt" DESC);

CREATE INDEX "notifications_organizationId_eventType_createdAt_idx"
  ON "notifications"("organizationId", "eventType", "createdAt" DESC);

CREATE INDEX "notifications_userId_readAt_idx"
  ON "notifications"("userId", "readAt");

CREATE INDEX "notification_deliveries_notificationId_attempt_idx"
  ON "notification_deliveries"("notificationId", "attempt");

CREATE INDEX "notification_deliveries_status_createdAt_idx"
  ON "notification_deliveries"("status", "createdAt" DESC);

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notification_deliveries"
  ADD CONSTRAINT "notification_deliveries_notificationId_fkey"
  FOREIGN KEY ("notificationId") REFERENCES "notifications"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_attempt_check" CHECK ("idempotencyKey" <> '');

ALTER TABLE "notification_deliveries"
  ADD CONSTRAINT "notification_deliveries_attempt_check" CHECK ("attempt" >= 1);
