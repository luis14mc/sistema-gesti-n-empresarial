// ============================================
// TIPOS FRONTEND — Fuente de verdad: prisma/schema.prisma
// ============================================

// ── Enums (mirror de Prisma) ──────────────────────────────────

export type Role = 'ADMIN' | 'USER' | 'RRHH' | 'IT';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type OficioType = 'INCOMING' | 'OUTGOING' | 'INTERNAL_MEMO';
export type OficioScope = 'INTERNO' | 'CNI' | 'DESPACHO';
export type OficioDirection = 'INCOMING' | 'OUTGOING' | 'INTERNAL_MEMO';

export type AttendanceStatus = 'ON_TIME' | 'LATE' | 'ABSENT' | 'EXCUSED';

export type EquipmentStatus = 'AVAILABLE' | 'ASSIGNED' | 'IN_MAINTENANCE' | 'DAMAGED' | 'RETIRED' | 'LOST';

export type MovementType = 'EXIT' | 'RETURN';

// Constantes legibles para selects/badges
export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  USER: 'Usuario',
  RRHH: 'Recursos Humanos',
  IT: 'Tecnología',
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Abierto',
  IN_PROGRESS: 'En Progreso',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado',
  CANCELLED: 'Cancelado',
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

export const OFICIO_TYPE_LABELS: Record<OficioType, string> = {
  INCOMING: 'Entrada',
  OUTGOING: 'Salida',
  INTERNAL_MEMO: 'Memo Interno',
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  ON_TIME: 'A Tiempo',
  LATE: 'Tarde',
  ABSENT: 'Ausente',
  EXCUSED: 'Justificado',
};

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  AVAILABLE: 'Disponible',
  ASSIGNED: 'Asignado',
  IN_MAINTENANCE: 'En Mantenimiento',
  DAMAGED: 'Dañado',
  RETIRED: 'Dado de Baja',
  LOST: 'Extraviado',
};

export const OFICIO_STATUS_LABELS: Record<OficioStatus, string> = {
  DRAFT: 'Borrador',
  SENT: 'Enviado',
  RECEIVED: 'Recibido',
  IN_PROCESS: 'En proceso',
  COMPLETED: 'Completado',
  ARCHIVED: 'Archivado',
};

// ── Usuario de sesión (serializable, sin password) ────────────

export interface SessionUser {
  id: string;
  employeeNumber: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  departmentId: string | null;
  positionId: string | null;
  department: { id: string; name: string } | null;
  position: { id: string; name: string } | null;
}

// ── Resultado genérico de Server Actions ──────────────────────

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

// ── Dashboard ─────────────────────────────────────────────────

export interface DashboardStats {
  totalOficios: number;
  inProcessOficios: number;
  totalEquipment: number;
  availableEquipment: number;
  activeAssignments: number;
  pendingPurchases: number;
  activeUsers: number;
}

export interface DashboardRecentOficio {
  id: string;
  number: string;
  subject: string;
  status: string;
  type: string;
  createdAt: Date;
}

// ── Modelos serializados (para Client Components) ─────────────

export interface Department {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface JobPosition {
  id: string;
  name: string;
  departmentId: string;
  isActive: boolean;
  department?: Department;
}

export interface User {
  id: string;
  employeeNumber: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  departmentId: string | null;
  positionId: string | null;
  createdAt: string;
  updatedAt: string;
  department?: Department | null;
  position?: JobPosition | null;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  type: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  attachmentUrl: string | null;
  deletedAt: string | null;
  attachments: any;
  comments: any[];
  createdById: string;
  assignedToId: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: Pick<User, 'id' | 'firstName' | 'lastName'>;
  assignedTo?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
}

export interface OficioAttachment {
  url: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export type OficioRecordSource =
  | 'SYSTEM_CREATED'
  | 'HISTORICAL_IMPORT'
  | 'MANUAL_REGISTRATION';

export type OficioTrackingAction =
  | 'CREATED'
  | 'IMPORTED'
  | 'RECEIVED'
  | 'SENT'
  | 'ASSIGNED'
  | 'IN_REVIEW'
  | 'FORWARDED'
  | 'RESPONDED'
  | 'COMPLETED'
  | 'ARCHIVED'
  | 'DOCUMENT_ADDED'
  | 'STATUS_CHANGED'
  | 'COMMENT_ADDED';

export type OficioImportBatchStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type OficioImportBatchItemStatus =
  | 'PENDING'
  | 'IMPORTED'
  | 'SKIPPED'
  | 'ERROR';

export type OficioDocumentType =
  | 'OFICIO_PRINCIPAL'
  | 'ANEXO'
  | 'RESPUESTA'
  | 'ACUSE_RECIBO'
  | 'SOPORTE'
  | 'OTRO';

export const OFICIO_RECORD_SOURCE_LABELS: Record<OficioRecordSource, string> = {
  SYSTEM_CREATED: 'Creado en sistema',
  HISTORICAL_IMPORT: 'Importado (histórico)',
  MANUAL_REGISTRATION: 'Registro manual',
};

export const OFICIO_TRACKING_ACTION_LABELS: Record<OficioTrackingAction, string> = {
  CREATED: 'Creado',
  IMPORTED: 'Importado',
  RECEIVED: 'Recibido',
  SENT: 'Enviado',
  ASSIGNED: 'Asignado',
  IN_REVIEW: 'En revisión',
  FORWARDED: 'Reenviado',
  RESPONDED: 'Respondido',
  COMPLETED: 'Completado',
  ARCHIVED: 'Archivado',
  DOCUMENT_ADDED: 'Documento agregado',
  STATUS_CHANGED: 'Estado cambiado',
  COMMENT_ADDED: 'Comentario agregado',
};

export const OFICIO_DOCUMENT_TYPE_LABELS: Record<OficioDocumentType, string> = {
  OFICIO_PRINCIPAL: 'Oficio principal',
  ANEXO: 'Anexo',
  RESPUESTA: 'Respuesta',
  ACUSE_RECIBO: 'Acuse de recibo',
  SOPORTE: 'Soporte',
  OTRO: 'Otro',
};

export const OFICIO_IMPORT_BATCH_STATUS_LABELS: Record<OficioImportBatchStatus, string> = {
  PENDING: 'Pendiente',
  PROCESSING: 'Procesando',
  COMPLETED: 'Completado',
  FAILED: 'Fallido',
  CANCELLED: 'Cancelado',
};

export interface OficioDocument {
  id: string;
  oficioId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  url: string;
  fileHash: string | null;
  documentType: string;
  isPrimary: boolean;
  version: number;
  uploadedById: string;
  uploadedAt: string;
  uploadedBy?: Pick<User, 'id' | 'firstName' | 'lastName'>;
}

export interface OficioTracking {
  id: string;
  oficioId: string;
  action: OficioTrackingAction;
  title: string;
  description: string | null;
  previousData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  performedById: string;
  createdAt: string;
  performedBy?: Pick<User, 'id' | 'firstName' | 'lastName'>;
}

export interface OficioImportBatchItem {
  id: string;
  batchId: string;
  rowIndex: number;
  status: OficioImportBatchItemStatus;
  originalName: string | null;
  number: string | null;
  institution: string | null;
  oficioDate: string | null;
  fileHash: string | null;
  errorMessage: string | null;
  oficioId: string | null;
}

export interface OficioImportBatch {
  id: string;
  source: OficioRecordSource;
  status: OficioImportBatchStatus;
  totalFiles: number;
  imported: number;
  skipped: number;
  errors: number;
  notes: string | null;
  performedById: string;
  startedAt: string;
  finishedAt: string | null;
  performedBy?: Pick<User, 'id' | 'firstName' | 'lastName'>;
  items?: OficioImportBatchItem[];
}

export interface Oficio {
  id: string;
  number: string;
  systemNumber: string | null;
  type: OficioType;
  scope?: OficioScope | string | null;
  subject: string;
  recipient?: string | null;
  institution?: string | null;
  preparedBy?: string | null;
  content?: string;
  status: OficioStatus;
  attachmentUrl?: string | null;
  deletedAt?: string | null;
  attachments?: OficioAttachment[] | unknown;
  recordSource: OficioRecordSource;
  importedById: string | null;
  importedAt: string | null;
  comments?: string | null;
  oficioDate: string;
  receivedDate?: string | null;
  sentDate?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: Pick<User, 'id' | 'firstName' | 'lastName'>;
  importedBy?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
  documents?: OficioDocument[];
  tracking?: OficioTracking[];
}

export interface TimeEntry {
  id: string;
  userId: string;
  type: EntryType;
  timestamp: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  latitude: number;
  longitude: number;
  location: string | null;
  status: AttendanceStatus;
  notes: string | null;
  createdAt: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName'>;
}

export interface Equipment {
  id: string;
  code: string;
  assetCode?: string;
  inventoryCode: string;
  name: string;
  type: string;
  category?: string;
  categoryLabel?: string;
  brand: string;
  model: string;
  serialNumber: string | null;
  status: EquipmentStatus;
  description: string | null;
  purchaseDate: string | null;
  purchaseCost: number | null;
  warrantyDate: string | null;
  depreciationDate: string | null;
  ram: string | null;
  processor: string | null;
  storage: string | null;
  os: string | null;
  location?: string | null;
  notes?: string | null;
  assignedTo?: string | null;
  assignedDepartment?: string | null;
  retirementReason: string | null;
  retiredAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignments?: EquipmentAssignment[];
  maintenances?: EquipmentMaintenance[];
  history?: EquipmentHistoryEntry[];
}

export interface EquipmentHistoryEntry {
  id: string;
  equipmentId: string;
  action: string;
  title: string;
  description: string | null;
  previousData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  performedById: string | null;
  createdAt: string;
}

export interface Employee {
  id: string;
  employeeCode: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string | null;
  dni: string | null;
  departmentId: string | null;
  positionId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  department?: { id: string; name: string } | null;
  position?: { id: string; name: string } | null;
  assignments?: EquipmentAssignment[];
}

export interface EquipmentAssignment {
  id: string;
  equipmentId: string;
  employeeId?: string | null;
  userId?: string | null;
  status: string;
  condition: string | null;
  assignedDate: string;
  returnedDate: string | null;
  departmentAtTime: string | null;
  positionAtTime: string | null;
  employeeNameAtTime?: string | null;
  employeeEmailAtTime?: string | null;
  assigneeName?: string | null;
  assigneeEmail?: string | null;
  deliveryReason?: string | null;
  returnReason?: string | null;
  returnCondition?: string | null;
  assignmentNotes?: string | null;
  returnNotes?: string | null;
  notes: string | null;
  urlNotaPdf: string | null;
  deliveryDocumentUrl?: string | null;
  returnDocumentUrl?: string | null;
  equipment?: Equipment;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
  employee?: Pick<Employee, 'id' | 'fullName' | 'email' | 'department' | 'position'>;
}

export interface PromotionalItem {
  id: string;
  code: string;
  inventoryCode: string;
  name: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  unitCost: number | null;
  purchaseDate: string;
  status: string;
  createdAt: string;
  movements?: PromotionalMovement[];
}

export interface PromotionalMovement {
  id: string;
  itemId: string;
  type: MovementType | string;
  quantity: number;
  quantityOut: number;
  quantityReturn: number | null;
  reason: string;
  notes: string | null;
  movementDate: string;
  returnDate: string | null;
  eventName: string | null;
  eventLocation: string | null;
  eventDate: string | null;
  responsible: string | null;
  comments: string | null;
  createdAt: string;
  item?: PromotionalItem;
  user?: Pick<User, 'id' | 'firstName' | 'lastName'>;
}

/**
 * @deprecated Usar `CompraSolicitudItem` desde `@/types/compras`.
 * Solo para `purchases.service` / `usePurchases` legacy (API 410).
 */
export interface PurchaseItem {
  id: string;
  purchaseRequestId: string;
  description: string;
  quantity: number;
  unitPrice: number | null;
  totalPrice: number | null;
  specifications: string | null;
  received: boolean;
}

/**
 * @deprecated Usar `CompraSolicitud` desde `@/types/compras`.
 * Solo para `purchases.service` / `usePurchases` legacy (API 410).
 */
export interface PurchaseRequest {
  id: string;
  number: string;
  title: string;
  description: string;
  justification: string;
  category: string;
  priority: string;
  status: string;
  estimatedTotal: number | null;
  approvedBudget: number | null;
  supplier: string | null;
  supplierContact: string | null;
  rejectionReason: string | null;
  notes: string | null;
  deliveryDate: string | null;
  receptionDate: string | null;
  closingDate: string | null;
  attachments: unknown;
  comments: string | null;
  requestedById: string;
  approvedById: string | null;
  createdAt: string;
  updatedAt: string;
  requestedBy?: Pick<User, 'id' | 'firstName' | 'lastName'>;
  approvedBy?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
  items?: PurchaseItem[];
}

export interface AuditRecord {
  id: string;
  title: string;
  description: string;
  justification: string | null;
  module: string;
  category: string;
  priority: string;
  status: string;
  entityId: string | null;
  userId: string | null;
  createdAt: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
}

// ── Paginación ────────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ── Aliases de compatibilidad (tipos legacy) ─────────────────
// Estos tipos existían como enums en el schema anterior.
// Ahora son strings libres en Prisma, pero los mantenemos como
// type aliases para no romper páginas aún no migradas.

export type TicketCategory = string;
export type OficioStatus = 'DRAFT' | 'SENT' | 'RECEIVED' | 'IN_PROCESS' | 'COMPLETED' | 'ARCHIVED';
export type EntryType = 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_START' | 'BREAK_END';
export type EquipmentType = string;
export type AssignmentStatus = 'ACTIVE' | 'RETURNED' | 'REPLACED' | 'LOST' | 'CANCELLED';
export type MaintenanceType = 'PREVENTIVE' | 'CORRECTIVE' | 'UPDATE';
export type MaintenanceStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type PurchaseCategory = string;
export type PurchasePriority = string;
export type PurchaseStatus = string;
export type PromotionalStatus = string;

// Interfaces legacy para retrocompatibilidad
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  employeeNumber?: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface EquipmentMaintenance {
  id: string;
  equipmentId: string;
  type: MaintenanceType;
  status: MaintenanceStatus;
  description: string;
  scheduledDate: string;
  completedDate?: string;
  cost?: number;
  technician?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateMaintenanceData extends Partial<CreateMaintenanceData> {
  status?: string;
}

export interface CreateTicketData {
  title: string;
  description: string;
  priority: TicketPriority;
  category: string;
  type: string;
  assignedToId?: string;
  attachmentUrl: string;
}

export interface UpdateTicketData extends Partial<CreateTicketData> {
  status?: TicketStatus;
}

export interface CreateOficioData {
  number?: string;
  externalNumber?: string;
  scope: OficioScope;
  direction: OficioDirection;
  recipient: string;
  institution: string;
  subject: string;
  preparedBy: string;
  oficioDate: string;
  receivedDate?: string;
  sentDate?: string;
  attachments: OficioAttachment[];
}

export interface UpdateOficioData {
  subject?: string;
  recipient?: string;
  institution?: string;
  preparedBy?: string;
  status?: string;
  attachments?: OficioAttachment[];
  oficioDate?: string;
  receivedDate?: string;
  sentDate?: string;
}

export interface CreateTimeEntryData {
  type?: EntryType;
  location?: string;
  latitude: number;
  longitude: number;
  notes?: string;
}

export interface CreateEquipmentData {
  code?: string;
  inventoryCode?: string;
  assetCode?: string;
  category?: string;
  name?: string;
  type: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  description?: string;
  notes?: string;
  ram?: string;
  processor?: string;
  storage?: string;
  os?: string;
}

export interface UpdateEquipmentData extends Partial<CreateEquipmentData> {
  status?: EquipmentStatus;
}

export interface CreateMaintenanceData {
  equipmentId: string;
  type?: string;
  description?: string;
  scheduledDate?: string;
  completedDate?: string;
  cost?: number;
  notes?: string;
}

export interface TicketComment {
  id: string;
  content: string;
  ticketId: string;
  userId: string;
  createdAt: string;
  updatedAt?: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName'>;
}

export interface ApiError {
  message?: string;
  error?: string;
  statusCode?: number;
  errors?: Record<string, string[]>;
}

// ── Filter types (para hooks React Query) ─────────────────────

export interface TicketFilters extends PaginationParams {
  search?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: string;
  assignedToId?: string;
}

export interface OficioFilters extends PaginationParams {
  search?: string;
  status?: string;
  type?: OficioType;
  scope?: OficioScope;
  direction?: OficioDirection;
}

export interface TimeEntryFilters extends PaginationParams {
  userId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * @deprecated Usar `CompraSolicitudFilters` desde `@/types/compras`.
 */
export interface PurchaseFilters extends PaginationParams {
  search?: string;
  status?: string;
  category?: string;
  priority?: string;
}

export interface PromotionalItemFilters extends PaginationParams {
  search?: string;
  status?: string;
}

export interface EquipmentFilters extends PaginationParams {
  search?: string;
  status?: EquipmentStatus;
  type?: string;
}

export interface AssignmentFilters extends PaginationParams {
  status?: string;
  equipmentId?: string;
  userId?: string;
  employeeId?: string;
}

// ── Data types para mutaciones ────────────────────────────────

export interface CreateCommentData {
  content: string;
}

/**
 * @deprecated Usar `CreateCompraSolicitudData` desde `@/types/compras`.
 */
export interface CreatePurchaseData {
  title: string;
  justification: string;
  category: string;
  priority: string;
  supplier?: string;
  supplierContact?: string;
  notes?: string;
}

/**
 * @deprecated Usar `UpdateCompraSolicitudData` desde `@/types/compras`.
 */
export interface UpdatePurchaseData extends Partial<CreatePurchaseData> {
  status?: string;
  rejectionReason?: string;
  approvedBudget?: number;
}

/**
 * @deprecated Usar `CreateCompraSolicitudItemData` desde `@/types/compras`.
 */
export interface CreatePurchaseItemData {
  description: string;
  quantity: number;
  unitPrice?: number;
  specifications?: string;
}

export interface CreatePromotionalItemData {
  code: string;
  name: string;
  description?: string;
  quantity: number;
  unitCost?: number;
}

export interface UpdatePromotionalItemData {
  name?: string;
  description?: string;
  unitCost?: number;
  status?: string;
}

export interface CreatePromotionalMovementData {
  itemId?: string;
  type: string;
  quantity: number;
  reason: string;
  notes?: string;
}

export interface CreateUserData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: Role;
  employeeNumber?: string;
  phone?: string;
  departmentId?: string;
  positionId?: string;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: Role;
  isActive?: boolean;
  phone?: string;
  departmentId?: string;
  positionId?: string;
}

export interface CreateAssignmentData {
  equipmentId: string;
  employeeId?: string;
  userId?: string;
  deliveryReason?: string;
  condition?: string;
  accessories?: string;
  assignmentNotes?: string;
  notes?: string;
}

export interface ReturnAssignmentData {
  returnCondition?: string;
  returnReason?: string;
  returnNotes?: string;
  notes?: string;
  equipmentStatusAfter?: EquipmentStatus;
  accessoriesReturned?: string;
}

export interface SwapEquipmentData {
  oldAssignmentId: string;
  newEquipmentId: string;
  employeeId?: string;
  userId?: string;
  returnReason?: string;
  returnCondition?: string;
  equipmentStatusAfter?: EquipmentStatus;
  deliveryReason?: string;
  assignmentNotes?: string;
  accessories?: string;
}

export interface CreateEmployeeData {
  employeeCode?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dni?: string;
  departmentId?: string;
  positionId?: string;
}

export interface UpdateEmployeeData extends Partial<CreateEmployeeData> {
  isActive?: boolean;
}

export interface EmployeeFilters extends PaginationParams {
  search?: string;
  departmentId?: string;
  isActive?: boolean;
}

export interface EquipmentStats {
  total: number;
  available: number;
  assigned: number;
  inMaintenance: number;
  damaged: number;
  retired: number;
  lost: number;
  withoutSerial: number;
  warrantyExpiring: number;
  unassigned: number;
  byCategory: { category: string; label: string; count: number }[];
  byDepartment: { department: string; count: number }[];
}

// ── Tipos legacy de Auditoría ─────────────────────────────────

export type AuditLog = AuditRecord;

export interface Audit {
  id: string;
  code?: string;
  title: string;
  description: string;
  status: string;
  module: string;
  category: string;
  priority: string;
  type?: string;
  standard?: string;
  scope?: string;
  objectives?: string;
  criteria?: string;
  department?: string;
  conclusions?: string;
  recommendations?: string;
  auditeeContact?: string;
  entityId: string | null;
  userId: string | null;
  leadAuditorId?: string | null;
  leadAuditor?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
  plannedDate?: string;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
  findings?: AuditFinding[];
  checklist?: AuditChecklistItem[];
}

export interface CreateAuditData {
  title: string;
  description?: string;
  module?: string;
  category?: string;
  priority?: string;
  type?: string;
  standard?: string;
  scope?: string;
  objectives?: string;
  criteria?: string;
  department?: string;
  leadAuditorId?: string;
  plannedDate?: string;
}

export interface UpdateAuditData extends Partial<CreateAuditData> {
  status?: string;
  conclusions?: string;
  recommendations?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditFinding {
  id: string;
  auditId: string;
  code?: string;
  description: string;
  evidence?: string;
  severity: string;
  clause?: string;
  status: string;
  createdAt: string;
}

export interface CreateFindingData {
  description: string;
  severity: string;
  evidence?: string;
  clause?: string;
}

export interface AuditChecklistItem {
  id: string;
  auditId: string;
  description: string;
  requirement?: string;
  clause?: string;
  sortOrder?: number;
  completed: boolean;
  result: string | null;
  notes?: string | null;
  evidence?: string | null;
  createdAt: string;
}

export interface CreateChecklistItemData {
  description?: string;
  requirement?: string;
  clause?: string;
  sortOrder?: number;
}

export interface UpdateChecklistResultData {
  completed?: boolean;
  result?: string;
  notes?: string;
  evidence?: string;
}

// ── Acciones Correctivas (legacy stub) ───────────────────────

export interface CorrectiveAction {
  id: string;
  findingId?: string;
  description: string;
  responsibleId?: string;
  responsible?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
  dueDate?: string;
  completedDate?: string | null;
  status: string;
  evidence?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Utilidades ────────────────────────────────────────────────

export interface SelectOption {
  label: string;
  value: string;
}

// ── Módulo Compras (modelo institucional) ─────────────────────
export * from './compras';
