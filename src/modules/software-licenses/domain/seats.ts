export const SEAT_TYPES = ['INDIVIDUAL', 'SHARED', 'DEVICE'] as const;
export const SEAT_STATUSES = ['AVAILABLE', 'ASSIGNED', 'SUSPENDED', 'CANCELLED'] as const;

export type SeatType = (typeof SEAT_TYPES)[number];
export type SeatStatus = (typeof SEAT_STATUSES)[number];

export type SeatOccupancy = {
  seatType: SeatType;
  status: SeatStatus;
  activeAssignments: number;
  equipmentId?: string | null;
};

export function isSeatInUse(seat: SeatOccupancy): boolean {
  if (seat.status === 'SUSPENDED' || seat.status === 'CANCELLED') return false;
  if (seat.seatType === 'DEVICE' && seat.equipmentId) return true;
  return seat.activeAssignments > 0;
}

/** Estado derivado para UI y reglas (ASSIGNED ≈ En uso, AVAILABLE ≈ Libre). */
export function effectiveSeatStatus(seat: SeatOccupancy): SeatStatus {
  if (seat.status === 'SUSPENDED' || seat.status === 'CANCELLED') return seat.status;
  return isSeatInUse(seat) ? 'ASSIGNED' : 'AVAILABLE';
}

export function isOccupiedSeat(seat: SeatOccupancy): boolean {
  return effectiveSeatStatus(seat) === 'ASSIGNED';
}

export function isAvailableSeat(seat: SeatOccupancy): boolean {
  return effectiveSeatStatus(seat) === 'AVAILABLE';
}

export function isSharedAccount(seat: SeatOccupancy): boolean {
  return seat.seatType === 'SHARED' && isOccupiedSeat(seat);
}

export function canAssignSeat(seat: SeatOccupancy): boolean {
  const status = effectiveSeatStatus(seat);
  if (status === 'SUSPENDED' || status === 'CANCELLED') return false;
  if (seat.seatType === 'INDIVIDUAL' && seat.activeAssignments > 0) return false;
  if (seat.seatType === 'DEVICE') return true;
  return true;
}

export function canChangeSeatTypeTo(
  target: SeatType,
  seat: SeatOccupancy,
): { ok: true } | { ok: false; code: string; message: string } {
  if (target === 'INDIVIDUAL' && seat.activeAssignments > 1) {
    return {
      ok: false,
      code: 'SEAT_TYPE_CHANGE_BLOCKED',
      message: 'No puede pasar a cuenta personal con más de una asignación activa.',
    };
  }
  if (target === 'DEVICE' && seat.activeAssignments > 0 && !seat.equipmentId) {
    return { ok: false, code: 'SEAT_TYPE_CHANGE_BLOCKED', message: 'Cierre las asignaciones antes de cambiar a clave de equipo.' };
  }
  return { ok: true };
}

export function assertSeatFields(input: {
  seatType: SeatType;
  accountEmail?: string | null;
  equipmentId?: string | null;
}) {
  if (input.seatType === 'INDIVIDUAL' || input.seatType === 'SHARED') {
    if (!input.accountEmail?.trim()) {
      throw new Error('ACCOUNT_EMAIL_REQUIRED');
    }
  }
  if (input.seatType === 'DEVICE' && !input.equipmentId) {
    throw new Error('EQUIPMENT_REQUIRED');
  }
}

export function assertSameOrganization(employeeOrganizationId: string, subscriptionOrganizationId: string) {
  if (employeeOrganizationId !== subscriptionOrganizationId) {
    throw new Error('CROSS_ORGANIZATION_ASSIGNMENT');
  }
}

export type SeatCounts = {
  contractedSeats: number;
  registeredSeats: number;
  inUseSeats: number;
  freeSeats: number;
  exceedsContract: boolean;
  /** Compatibilidad con vistas anteriores */
  occupiedSeats: number;
  availableSeats: number;
  assignedUsers: number;
  sharedAccounts: number;
  unusedSeats: number;
};

export function unitMonthlyCost(monthlyCost: number, contractedSeats: number): number {
  if (contractedSeats <= 0) return 0;
  return monthlyCost / contractedSeats;
}

export function summarizeSeats(
  seats: Array<SeatOccupancy & { status: SeatStatus }>,
  contractedSeats: number,
): SeatCounts {
  const registeredRows = seats.filter((seat) => seat.status !== 'CANCELLED');
  const registeredSeats = registeredRows.length;
  const inUseSeats = registeredRows.filter(isSeatInUse).length;
  const freeSeats = registeredRows.filter(
    (seat) => seat.status !== 'SUSPENDED' && !isSeatInUse(seat),
  ).length;
  const assignedUsers = registeredRows.reduce(
    (sum, seat) => sum + (seat.status === 'CANCELLED' ? 0 : seat.activeAssignments),
    0,
  );
  const sharedAccounts = registeredRows.filter(isSharedAccount).length;
  return {
    contractedSeats,
    registeredSeats,
    inUseSeats,
    freeSeats,
    exceedsContract: registeredSeats > contractedSeats,
    occupiedSeats: inUseSeats,
    availableSeats: freeSeats,
    assignedUsers,
    sharedAccounts,
    unusedSeats: Math.max(0, contractedSeats - inUseSeats),
  };
}
