
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER', 'RRHH', 'IT');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('ON_TIME', 'LATE', 'ABSENT', 'EXCUSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "OficioType" AS ENUM ('INCOMING', 'OUTGOING', 'INTERNAL_MEMO');

-- CreateEnum
CREATE TYPE "EquipmentCategory" AS ENUM ('DESKTOP_PC', 'LAPTOP', 'PRINTER', 'PHONE', 'MONITOR', 'UPS', 'ACCESSORY', 'OTHER');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'IN_MAINTENANCE', 'DAMAGED', 'RETIRED', 'LOST');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'RETURNED', 'REPLACED', 'LOST', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EquipmentHistoryAction" AS ENUM ('CREATED', 'ASSIGNED', 'RETURNED', 'REPLACED', 'MAINTENANCE', 'STATUS_CHANGED', 'RETIRED', 'UPDATED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('EXIT', 'RETURN');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('PREVENTIVE', 'CORRECTIVE', 'UPDATE', 'INSPECTION');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditType" AS ENUM ('INTERNAL', 'EXTERNAL', 'COMBINED');

-- CreateEnum
CREATE TYPE "AuditFindingSeverity" AS ENUM ('STRENGTH', 'CONFORMITY', 'OBSERVATION', 'MINOR_NC', 'MAJOR_NC');

-- CreateEnum
CREATE TYPE "ChecklistResult" AS ENUM ('CONFORMING', 'NON_CONFORMING', 'OBSERVATION', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "CorrectiveActionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED');

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_positions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "officialCheckIn" TEXT NOT NULL,
    "officialCheckOut" TEXT NOT NULL,
    "toleranceMinutes" INTEGER NOT NULL DEFAULT 15,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "attendance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "departmentId" TEXT,
    "positionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_records" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "justification" TEXT,
    "module" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "deliveryDate" TIMESTAMP(3),
    "receptionDate" TIMESTAMP(3),
    "closingDate" TIMESTAMP(3),
    "attachments" JSONB,
    "comments" TEXT,
    "entityId" TEXT,
    "previousData" JSONB,
    "newData" JSONB,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'ON_TIME',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "attachments" JSONB,
    "comments" JSONB,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oficios" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "OficioType" NOT NULL,
    "scope" TEXT,
    "subject" TEXT NOT NULL,
    "recipient" TEXT,
    "institution" TEXT,
    "preparedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "attachments" JSONB NOT NULL,
    "comments" TEXT,
    "oficioDate" DATE NOT NULL,
    "receivedDate" DATE,
    "sentDate" DATE,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oficios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "employeeCode" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "dni" TEXT,
    "userId" TEXT,
    "departmentId" TEXT,
    "positionId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "inventoryCode" TEXT NOT NULL,
    "category" "EquipmentCategory" NOT NULL DEFAULT 'OTHER',
    "type" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serialNumber" TEXT,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'AVAILABLE',
    "purchaseDate" DATE,
    "purchaseOrder" TEXT,
    "supplier" TEXT,
    "warrantyDate" DATE,
    "depreciationDate" DATE,
    "cost" DOUBLE PRECISION,
    "ram" TEXT,
    "processor" TEXT,
    "storage" TEXT,
    "os" TEXT,
    "ipAddress" TEXT,
    "macAddress" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "retirementReason" TEXT,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_assignments" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "employeeId" TEXT,
    "userId" TEXT,
    "assignedById" TEXT,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedDate" TIMESTAMP(3),
    "departmentAtTime" TEXT,
    "positionAtTime" TEXT,
    "employeeEmailAtTime" TEXT,
    "employeeNameAtTime" TEXT,
    "deliveryReason" TEXT,
    "assignmentNotes" TEXT,
    "deliveryDocumentUrl" TEXT,
    "returnDocumentUrl" TEXT,
    "returnedById" TEXT,
    "returnReason" TEXT,
    "returnNotes" TEXT,
    "returnCondition" TEXT,
    "notes" TEXT,
    "urlNotaPdf" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_history" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "action" "EquipmentHistoryAction" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "previousData" JSONB,
    "newData" JSONB,
    "performedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotional_items" (
    "id" TEXT NOT NULL,
    "inventoryCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "purchaseDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotional_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotional_movements" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "quantityOut" INTEGER NOT NULL,
    "quantityReturn" INTEGER DEFAULT 0,
    "movementDate" DATE NOT NULL,
    "returnDate" DATE,
    "eventName" TEXT,
    "eventLocation" TEXT,
    "eventDate" DATE,
    "responsible" TEXT,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotional_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requests" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "deliveryDate" DATE,
    "receptionDate" DATE,
    "closingDate" DATE,
    "attachments" JSONB,
    "comments" TEXT,
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_maintenances" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "type" "MaintenanceType" NOT NULL DEFAULT 'PREVENTIVE',
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "description" TEXT NOT NULL,
    "scheduledDate" DATE,
    "completedDate" DATE,
    "cost" DOUBLE PRECISION,
    "technician" TEXT,
    "notes" TEXT,
    "documentUrl" TEXT,
    "performedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_maintenances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audits" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "AuditType" NOT NULL DEFAULT 'INTERNAL',
    "status" "AuditStatus" NOT NULL DEFAULT 'PLANNED',
    "standard" TEXT,
    "scope" TEXT,
    "objectives" TEXT,
    "criteria" TEXT,
    "department" TEXT,
    "conclusions" TEXT,
    "recommendations" TEXT,
    "auditeeContact" TEXT,
    "plannedDate" DATE,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "leadAuditorId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_findings" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT NOT NULL,
    "evidence" TEXT,
    "severity" "AuditFindingSeverity" NOT NULL,
    "clause" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_checklist_items" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "description" TEXT,
    "requirement" TEXT NOT NULL,
    "clause" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "result" "ChecklistResult",
    "notes" TEXT,
    "evidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corrective_actions" (
    "id" TEXT NOT NULL,
    "findingId" TEXT,
    "auditId" TEXT,
    "description" TEXT NOT NULL,
    "responsibleId" TEXT,
    "dueDate" DATE,
    "completedDate" TIMESTAMP(3),
    "status" "CorrectiveActionStatus" NOT NULL DEFAULT 'PENDING',
    "evidence" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corrective_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "job_positions_name_key" ON "job_positions"("name");

-- CreateIndex
CREATE INDEX "job_positions_departmentId_idx" ON "job_positions"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeNumber_key" ON "users"("employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_departmentId_idx" ON "users"("departmentId");

-- CreateIndex
CREATE INDEX "users_positionId_idx" ON "users"("positionId");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "audit_records_userId_idx" ON "audit_records"("userId");

-- CreateIndex
CREATE INDEX "audit_records_module_idx" ON "audit_records"("module");

-- CreateIndex
CREATE INDEX "audit_records_entityId_idx" ON "audit_records"("entityId");

-- CreateIndex
CREATE INDEX "audit_records_createdAt_idx" ON "audit_records"("createdAt");

-- CreateIndex
CREATE INDEX "time_entries_userId_idx" ON "time_entries"("userId");

-- CreateIndex
CREATE INDEX "time_entries_date_idx" ON "time_entries"("date");

-- CreateIndex
CREATE UNIQUE INDEX "time_entries_userId_date_key" ON "time_entries"("userId", "date");

-- CreateIndex
CREATE INDEX "tickets_createdById_idx" ON "tickets"("createdById");

-- CreateIndex
CREATE INDEX "tickets_assignedToId_idx" ON "tickets"("assignedToId");

-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

-- CreateIndex
CREATE UNIQUE INDEX "oficios_number_key" ON "oficios"("number");

-- CreateIndex
CREATE INDEX "oficios_createdById_idx" ON "oficios"("createdById");

-- CreateIndex
CREATE INDEX "oficios_status_idx" ON "oficios"("status");

-- CreateIndex
CREATE INDEX "oficios_type_idx" ON "oficios"("type");

-- CreateIndex
CREATE INDEX "oficios_scope_idx" ON "oficios"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employeeCode_key" ON "employees"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");

-- CreateIndex
CREATE INDEX "employees_departmentId_idx" ON "employees"("departmentId");

-- CreateIndex
CREATE INDEX "employees_positionId_idx" ON "employees"("positionId");

-- CreateIndex
CREATE INDEX "employees_email_idx" ON "employees"("email");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_inventoryCode_key" ON "equipment"("inventoryCode");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_serialNumber_key" ON "equipment"("serialNumber");

-- CreateIndex
CREATE INDEX "equipment_status_idx" ON "equipment"("status");

-- CreateIndex
CREATE INDEX "equipment_category_idx" ON "equipment"("category");

-- CreateIndex
CREATE INDEX "equipment_type_idx" ON "equipment"("type");

-- CreateIndex
CREATE INDEX "equipment_inventoryCode_idx" ON "equipment"("inventoryCode");

-- CreateIndex
CREATE INDEX "equipment_serialNumber_idx" ON "equipment"("serialNumber");

-- CreateIndex
CREATE INDEX "equipment_assignments_equipmentId_idx" ON "equipment_assignments"("equipmentId");

-- CreateIndex
CREATE INDEX "equipment_assignments_employeeId_idx" ON "equipment_assignments"("employeeId");

-- CreateIndex
CREATE INDEX "equipment_assignments_userId_idx" ON "equipment_assignments"("userId");

-- CreateIndex
CREATE INDEX "equipment_assignments_status_idx" ON "equipment_assignments"("status");

-- CreateIndex
CREATE INDEX "equipment_assignments_assignedDate_idx" ON "equipment_assignments"("assignedDate");

-- CreateIndex
CREATE INDEX "equipment_history_equipmentId_idx" ON "equipment_history"("equipmentId");

-- CreateIndex
CREATE INDEX "equipment_history_action_idx" ON "equipment_history"("action");

-- CreateIndex
CREATE INDEX "equipment_history_createdAt_idx" ON "equipment_history"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "promotional_items_inventoryCode_key" ON "promotional_items"("inventoryCode");

-- CreateIndex
CREATE INDEX "promotional_movements_itemId_idx" ON "promotional_movements"("itemId");

-- CreateIndex
CREATE INDEX "purchase_requests_requestedById_idx" ON "purchase_requests"("requestedById");

-- CreateIndex
CREATE INDEX "purchase_requests_status_idx" ON "purchase_requests"("status");

-- CreateIndex
CREATE INDEX "equipment_maintenances_equipmentId_idx" ON "equipment_maintenances"("equipmentId");

-- CreateIndex
CREATE INDEX "equipment_maintenances_status_idx" ON "equipment_maintenances"("status");

-- CreateIndex
CREATE INDEX "equipment_maintenances_scheduledDate_idx" ON "equipment_maintenances"("scheduledDate");

-- CreateIndex
CREATE UNIQUE INDEX "audits_code_key" ON "audits"("code");

-- CreateIndex
CREATE INDEX "audits_status_idx" ON "audits"("status");

-- CreateIndex
CREATE INDEX "audits_leadAuditorId_idx" ON "audits"("leadAuditorId");

-- CreateIndex
CREATE INDEX "audits_plannedDate_idx" ON "audits"("plannedDate");

-- CreateIndex
CREATE INDEX "audit_findings_auditId_idx" ON "audit_findings"("auditId");

-- CreateIndex
CREATE INDEX "audit_findings_severity_idx" ON "audit_findings"("severity");

-- CreateIndex
CREATE INDEX "audit_checklist_items_auditId_idx" ON "audit_checklist_items"("auditId");

-- CreateIndex
CREATE INDEX "audit_checklist_items_sortOrder_idx" ON "audit_checklist_items"("sortOrder");

-- CreateIndex
CREATE INDEX "corrective_actions_findingId_idx" ON "corrective_actions"("findingId");

-- CreateIndex
CREATE INDEX "corrective_actions_auditId_idx" ON "corrective_actions"("auditId");

-- CreateIndex
CREATE INDEX "corrective_actions_status_idx" ON "corrective_actions"("status");

-- CreateIndex
CREATE INDEX "corrective_actions_responsibleId_idx" ON "corrective_actions"("responsibleId");

-- AddForeignKey
ALTER TABLE "job_positions" ADD CONSTRAINT "job_positions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "job_positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_records" ADD CONSTRAINT "audit_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oficios" ADD CONSTRAINT "oficios_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "job_positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_assignments" ADD CONSTRAINT "equipment_assignments_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_assignments" ADD CONSTRAINT "equipment_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_assignments" ADD CONSTRAINT "equipment_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_history" ADD CONSTRAINT "equipment_history_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotional_movements" ADD CONSTRAINT "promotional_movements_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "promotional_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_maintenances" ADD CONSTRAINT "equipment_maintenances_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_leadAuditorId_fkey" FOREIGN KEY ("leadAuditorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_findings" ADD CONSTRAINT "audit_findings_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_checklist_items" ADD CONSTRAINT "audit_checklist_items_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

