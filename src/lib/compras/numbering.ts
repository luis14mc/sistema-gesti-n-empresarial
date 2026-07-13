import { prisma } from '@/lib/prisma';

export function formatCompraCodigo(sequence: number, year: number): string {
  return `SC-${sequence.toString().padStart(4, '0')}-${year}`;
}

export async function generateCompraCodigo(fechaSolicitud: Date): Promise<string> {
  const year = fechaSolicitud.getFullYear();
  const prefix = `SC-`;
  const suffix = `-${year}`;

  const latest = await prisma.compraSolicitud.findFirst({
    where: { codigoSolicitud: { endsWith: suffix } },
    orderBy: { codigoSolicitud: 'desc' },
    select: { codigoSolicitud: true },
  });

  let next = 1;
  if (latest?.codigoSolicitud) {
    const match = latest.codigoSolicitud.match(/SC-(\d{4})-/);
    if (match) next = Number.parseInt(match[1], 10) + 1;
  }

  return formatCompraCodigo(next, year);
}
