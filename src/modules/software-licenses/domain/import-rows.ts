import { parsePaymentText } from '@/modules/software-licenses/domain/billing';

export type LicenseImportRow = {
  rowNumber: number;
  software: string;
  usuario: string;
  correo: string;
  compartida: string;
  tipo: string;
  equipo: string;
  estado: string;
  fechaPago: string;
};

export type LicenseImportAssignment = {
  rowNumber: number;
  employeeName: string;
};

export type LicenseImportSeat = {
  accountEmail: string | null;
  equipmentInventoryCode: string | null;
  equipmentId?: string | null;
  seatType: 'INDIVIDUAL' | 'SHARED' | 'DEVICE';
  status: 'AVAILABLE' | 'ASSIGNED' | 'SUSPENDED' | 'CANCELLED';
  assignments: LicenseImportAssignment[];
};

export type LicenseImportProduct = {
  software: string;
  paymentDay: number | null;
  billingCycle: 'MONTHLY' | 'ANNUAL' | 'QUARTERLY' | 'OTHER';
  renewalDate: string | null;
  seats: LicenseImportSeat[];
};

export type LicenseImportWarning = {
  rowNumber: number;
  code: 'DUPLICATE_ASSIGNMENT' | 'MISSING_SOFTWARE' | 'UNMATCHED_EMPLOYEE' | 'MISSING_COST';
  message: string;
};

export type LicenseImportPlan = {
  products: LicenseImportProduct[];
  warnings: LicenseImportWarning[];
};

function sharedFlag(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return ['si', 'sí', 'yes', 'true', '1', 'compartida', 'compartido'].includes(normalized);
}

function parseSeatType(row: Pick<LicenseImportRow, 'tipo' | 'compartida'>): LicenseImportSeat['seatType'] {
  const tipo = row.tipo.trim().toLowerCase();
  if (['equipo', 'device', 'instalación', 'instalacion', 'clave'].includes(tipo)) return 'DEVICE';
  if (['compartida', 'shared', 'compartido'].includes(tipo) || sharedFlag(row.compartida)) return 'SHARED';
  return 'INDIVIDUAL';
}

function seatStatus(value: string, hasAssignee: boolean): LicenseImportSeat['status'] {
  const normalized = value.trim().toLowerCase();
  if (['suspendido', 'suspendida', 'suspended'].includes(normalized)) return 'SUSPENDED';
  if (['cancelado', 'cancelada', 'cancelled', 'canceled'].includes(normalized)) return 'CANCELLED';
  if (['disponible', 'available', 'libre'].includes(normalized) || !hasAssignee) return 'AVAILABLE';
  return 'ASSIGNED';
}

function keyOf(software: string, email: string) {
  return `${software.trim().toLowerCase()}::${email.trim().toLowerCase()}`;
}

/** Turns spreadsheet rows into one seat per software + email, with many assignments on shared accounts. */
export function planLicenseImport(rows: LicenseImportRow[]): LicenseImportPlan {
  const warnings: LicenseImportWarning[] = [];
  const products = new Map<string, LicenseImportProduct>();
  const seenAssignment = new Set<string>();

  for (const row of rows) {
    const software = row.software.trim();
    if (!software) {
      warnings.push({ rowNumber: row.rowNumber, code: 'MISSING_SOFTWARE', message: 'La fila no tiene software.' });
      continue;
    }
    const productKey = software.toLowerCase();
    let product = products.get(productKey);
    if (!product) {
      const payment = parsePaymentText(row.fechaPago);
      product = {
        software,
        paymentDay: payment.paymentDay,
        billingCycle: payment.billingCycle,
        renewalDate: payment.renewalDate,
        seats: [],
      };
      products.set(productKey, product);
      warnings.push({
        rowNumber: row.rowNumber,
        code: 'MISSING_COST',
        message: `${software} se importa sin costo. El monto se captura en la suscripción.`,
      });
    }

    const seatType = parseSeatType(row);
    const email = row.correo.trim().toLowerCase();
    const inventoryCode = row.equipo.trim();
    const seatKey =
      seatType === 'DEVICE'
        ? keyOf(software, inventoryCode || `device-${row.rowNumber}`)
        : keyOf(software, email || `row-${row.rowNumber}`);
    let seat =
      seatType === 'DEVICE'
        ? product.seats.find(
            (candidate) =>
              candidate.seatType === 'DEVICE' && (candidate.equipmentInventoryCode ?? '') === inventoryCode,
          )
        : email
          ? product.seats.find((candidate) => (candidate.accountEmail ?? '') === email)
          : undefined;
    if (!seat) {
      const usuario = row.usuario.trim();
      seat = {
        accountEmail: seatType === 'DEVICE' ? null : email || null,
        equipmentInventoryCode: seatType === 'DEVICE' ? inventoryCode || null : null,
        seatType,
        status: seatStatus(row.estado, Boolean(usuario) || Boolean(inventoryCode)),
        assignments: [],
      };
      product.seats.push(seat);
    } else if (seatType === 'SHARED' || seat.assignments.length > 0) {
      seat.seatType = 'SHARED';
    }

    const usuario = row.usuario.trim();
    if (!usuario || seat.status === 'CANCELLED') continue;
    const assignmentKey = `${seatKey}::${usuario.toLowerCase()}`;
    if (seenAssignment.has(assignmentKey)) {
      warnings.push({
        rowNumber: row.rowNumber,
        code: 'DUPLICATE_ASSIGNMENT',
        message: `${usuario} ya está en ${software} / ${email || 'sin correo'}.`,
      });
      continue;
    }
    seenAssignment.add(assignmentKey);
    seat.assignments.push({ rowNumber: row.rowNumber, employeeName: usuario });
    if (seat.assignments.length > 1) seat.seatType = 'SHARED';
    if (seat.status === 'AVAILABLE') seat.status = 'ASSIGNED';
  }

  return { products: [...products.values()], warnings };
}
