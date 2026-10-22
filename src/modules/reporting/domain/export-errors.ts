/** Synchronous export row cap exceeded (same contract as compras export). */
export class ReportExportTooLargeError extends Error {
  constructor(public readonly limit: number) {
    super('EXPORT_ROW_LIMIT_EXCEEDED');
    this.name = 'ReportExportTooLargeError';
  }
}
