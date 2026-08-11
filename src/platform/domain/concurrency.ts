import { ConcurrentModificationError } from './errors';

export function assertOptimisticUpdate(result: { count: number }, details?: unknown): void {
  if (result.count !== 1) throw new ConcurrentModificationError(details);
}
