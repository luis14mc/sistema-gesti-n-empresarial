import { InvalidStatusTransitionError } from './errors';

export type TransitionMap<TStatus extends string> = Readonly<Record<TStatus, readonly TStatus[]>>;

export function createTransitionPolicy<TStatus extends string>(
  transitions: TransitionMap<TStatus>,
  errorFactory: (from: TStatus, to: TStatus) => Error = (from, to) => new InvalidStatusTransitionError(from, to),
) {
  return {
    canTransition(from: TStatus, to: TStatus): boolean {
      return transitions[from]?.includes(to) ?? false;
    },
    assertAllowed(from: TStatus, to: TStatus): void {
      if (!(transitions[from]?.includes(to) ?? false)) throw errorFactory(from, to);
    },
  } as const;
}
