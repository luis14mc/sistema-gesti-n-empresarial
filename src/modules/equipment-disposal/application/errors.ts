export class EquipmentDisposalError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(code);
    this.name = 'EquipmentDisposalError';
  }
}
