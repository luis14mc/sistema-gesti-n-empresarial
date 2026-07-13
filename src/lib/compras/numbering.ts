import { prisma } from '@/lib/prisma';

export async function generateCompraNumero(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SC-`;
  const suffix = `-${year}`;

  const last = await prisma.compraSolicitud.findFirst({
    where: { numero: { endsWith: suffix } },
    orderBy: { numero: 'desc' },
    select: { numero: true },
  });

  let seq = 1;
  if (last?.numero) {
    const match = last.numero.match(/SC-(\d+)-/);
    if (match) seq = Number.parseInt(match[1], 10) + 1;
  }

  return `${prefix}${String(seq).padStart(4, '0')}${suffix}`;
}
