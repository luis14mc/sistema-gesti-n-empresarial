let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter.toString(36)}`;
}

export function resetUserFactoryCounters(): void {
  counter = 0;
}

export type TestUserFixture = Readonly<{
  id: string;
  email: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  platformRole: 'PLATFORM_ADMIN' | 'SUPPORT_ADMIN' | null;
  role: 'ADMIN' | 'IT' | 'RRHH' | 'USER';
  password: string;
}>;

export function createTestUser(overrides: Partial<TestUserFixture> = {}): TestUserFixture {
  const id = overrides.id ?? nextId('user');
  return {
    id,
    email: overrides.email ?? `${id}@example.test`,
    employeeNumber: overrides.employeeNumber ?? `EMP-${id.toUpperCase()}`,
    firstName: overrides.firstName ?? 'Test',
    lastName: overrides.lastName ?? id,
    isActive: overrides.isActive ?? true,
    platformRole: overrides.platformRole ?? null,
    role: overrides.role ?? 'ADMIN',
    password: overrides.password ?? 'TestPassword!123',
  };
}

export function createTestUserPair(): { userA: TestUserFixture; userB: TestUserFixture } {
  return {
    userA: createTestUser({ id: 'user-a', email: 'user-a@example.test', employeeNumber: 'EMP-USER-A' }),
    userB: createTestUser({ id: 'user-b', email: 'user-b@example.test', employeeNumber: 'EMP-USER-B' }),
  };
}
