import type { PurchaseOrderStatus, PurchaseUnit, PurchaseDocumentType } from '@prisma/client';
import type { PurchaseOrderTemplateConfig } from '@/lib/compras/orden/template-config';

export type { PurchaseOrderStatus, PurchaseUnit, PurchaseDocumentType };

export interface CompraOrdenItem {
  id: string;
  orderId: string;
  itemNumber: number;
  description: string;
  unit: PurchaseUnit;
  quantity: number;
  unitPrice: number;
  total: number;
  // legacy
  item?: number;
  descripcion?: string;
  unidad?: string;
  cantidad?: number;
  precioUnitario?: number;
}

export interface CompraOrdenDocumento {
  id: string;
  orderId: string;
  type: PurchaseDocumentType;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  url: string;
  version: number;
  isActive: boolean;
  uploadedAt: string;
  uploadedBy?: { id: string; firstName: string; lastName: string };
  // legacy
  ordenId?: string;
  tipo?: string;
}

export interface CompraOrdenHistorialEntry {
  id: string;
  orderId: string;
  action: string;
  title: string;
  description?: string | null;
  createdAt: string;
  performedBy?: { id: string; firstName: string; lastName: string };
  ordenId?: string;
}

export interface CompraOrden {
  id: string;
  orderNumber?: string | null;
  sequenceNumber?: number | null;
  sequenceYear?: number | null;
  purchaseReference: string;
  requestDate: string;
  requiredDate: string;
  requestedByName: string;
  requesterJobTitle: string;
  createdById: string;
  supplierId?: string | null;
  supplierName: string;
  supplierRtn: string;
  supplierPhone: string;
  purchaseJustification: string;
  subtotal: number;
  discountType: 'NINGUNO' | 'MONTO' | 'PORCENTAJE';
  discountValue: number;
  discount: number;
  taxRate: number;
  tax: number;
  total: number;
  status: PurchaseOrderStatus;
  templateId?: string | null;
  templateVersion?: number | null;
  pdfUrl?: string | null;
  pdfVersion: number;
  items: CompraOrdenItem[];
  documentos?: CompraOrdenDocumento[];
  documentsCount?: number;
  format?: PurchaseOrderTemplateConfig;
  createdBy?: { id: string; firstName: string; lastName: string };
  supplier?: { id: string; nombreRazonSocial: string } | null;
  // legacy aliases
  numeroOrden?: string | null;
  referenciaCompra?: string;
  fechaSolicitud?: string;
  fechaRequerida?: string;
  solicitadoPorNombre?: string;
  cargoSolicitante?: string;
  solicitadoPorId?: string;
  proveedorId?: string | null;
  proveedorNombre?: string;
  proveedorRtn?: string;
  proveedorTelefono?: string;
  justificacionCompra?: string;
  tasaImpuesto?: number;
  impuesto?: number;
  descuento?: number;
  estado?: PurchaseOrderStatus;
}

export interface CreateCompraOrdenData {
  purchaseReference: string;
  requestDate?: string;
  requiredDate: string;
  requestedByName: string;
  requesterJobTitle: string;
  supplierId?: string | null;
  supplierName: string;
  supplierRtn: string;
  supplierPhone: string;
  purchaseJustification: string;
  discountType?: 'NINGUNO' | 'MONTO' | 'PORCENTAJE';
  discountValue?: number;
  taxRate?: number;
  items: Array<{
    itemNumber?: number;
    description: string;
    unit: PurchaseUnit;
    quantity: number;
    unitPrice: number;
  }>;
}

export type UpdateCompraOrdenData = CreateCompraOrdenData;

export interface CompraOrdenFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: PurchaseOrderStatus;
  estado?: PurchaseOrderStatus;
  mine?: boolean;
}

export type { PurchaseOrderTemplateConfig } from '@/lib/compras/orden/template-config';
export type { PurchaseOrderPreviewData } from '@/lib/compras/orden/preview-data';

export type OrdenWorkflowAction =
  | 'generar'
  | 'emitir'
  | 'anular'
  | 'cerrar'
  | 'regenerar_pdf';
