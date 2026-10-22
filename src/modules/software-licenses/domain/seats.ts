export const SEAT_TYPES = ['INDIVIDUAL', 'SHARED'] as const;
export const SEAT_STATUSES = ['AVAILABLE', 'ASSIGNED', 'SUSPENDED', 'CANCELLED'] as const;

export type SeatType = (typeof SEAT_TYPES)[number];
export type SeatStatus = (typeof SEAT_STATUSES)[number];

export type SeatOccupancy = {
  seatType: SeatType;
  status: SeatStatus;
  activeAssignments: number;
};

export function effectiveSeatStatus(seat: SeatOccupancy): SeatStatus {
  if (seat.status === 'SUSPENDED' || seat.status === 'CANCELLED') return seat.status;
  return seat.activeAssignments > 0 ? 'ASSIGNED' : 'AVAILABLE';
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
  return true;
}

export function canConvertToIndividual(seat: SeatOccupancy): boolean {
  return seat.seatType === 'SHARED' && seat.activeAssignments <= 1 && seat.status !== 'CANCELLED';
}

export function assertSameOrganization(employeeOrganizationId: string, subscriptionOrganizationId: string) {
  if (employeeOrganizationId !== subscriptionOrganizationId) {
    throw new Error('CROSS_ORGANIZATION_ASSIGNMENT');
  }
}

export function summarizeSeats(seats: SeatOccupancy[], contractedSeats: number) {
  const occupied = seats.filter(isOccupiedSeat).length;
  const available = seats.filter(isAvailableSeat).length;
  const assignedUsers = seats.reduce((sum, seat) => sum + (seat.status === 'CANCELLED' ? 0 : seat.activeAssignments), 0);
  const sharedAccounts = seats.filter(isSharedAccount).length;
  return {
    contractedSeats,
    occupiedSeats: occupied,
    availableSeats: available,
    assignedUsers,
    sharedAccounts,
    unusedSeats: Math.max(0, contractedSeats - occupied),
  };
}
