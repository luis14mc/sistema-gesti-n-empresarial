export function mapLegacyEstadoFilter(status?: string): string | undefined {
  if (!status) return undefined;
  const map: Record<string, string> = {
    BORRADOR: 'DRAFT',
    GENERADA: 'GENERATED',
    EMITIDA: 'ISSUED',
    ANULADA: 'CANCELLED',
    CERRADA: 'CLOSED',
  };
  return map[status] ?? status;
}
