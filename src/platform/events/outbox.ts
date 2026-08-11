import { Prisma, type PrismaClient } from '@prisma/client';

type OutboxClient = Prisma.TransactionClient | PrismaClient;

export type AppendOutboxEventInput = {
  organizationId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  eventVersion?: number;
  payload: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
};

export async function appendOutboxEvent(client: OutboxClient, input: AppendOutboxEventInput) {
  try {
    return await client.domainEventOutbox.create({ data: input });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
    return client.domainEventOutbox.findUniqueOrThrow({
      where: {
        organizationId_aggregateType_aggregateId_aggregateVersion_eventType: {
          organizationId: input.organizationId,
          aggregateType: input.aggregateType,
          aggregateId: input.aggregateId,
          aggregateVersion: input.aggregateVersion,
          eventType: input.eventType,
        },
      },
    });
  }
}
