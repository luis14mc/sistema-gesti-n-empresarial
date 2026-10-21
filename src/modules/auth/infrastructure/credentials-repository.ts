import { prisma } from '@/lib/prisma';

const sessionUserSelect = {
  id: true,
  employeeNumber: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  isActive: true,
  departmentId: true,
  positionId: true,
  department: { select: { id: true, name: true } },
  position: { select: { id: true, name: true } },
} as const;

export type NewUserData = {
  employeeNumber: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export function findSessionUserWithPasswordByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: { ...sessionUserSelect, password: true },
  });
}

export function findUserByEmailOrEmployeeNumber(email: string, employeeNumber: string) {
  return prisma.user.findFirst({
    where: { OR: [{ email }, { employeeNumber }] },
  });
}

export function createUser(data: NewUserData) {
  return prisma.user.create({
    data: { ...data, role: 'USER' },
  });
}

export function createSessionUser(data: NewUserData) {
  return prisma.user.create({
    data: { ...data, role: 'USER' },
    select: sessionUserSelect,
  });
}
