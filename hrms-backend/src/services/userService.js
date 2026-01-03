// services/userService.js
import prisma from "../prismaClient.js";

export const ACTIVE_EMPLOYEE_WHERE = {
  isActive: true,
  role: { in: ["AGILITY_EMPLOYEE", "LYF_EMPLOYEE"] },
};

export const countActiveEmployees = (extraWhere = {}) =>
  prisma.user.count({
    where: {
      ...ACTIVE_EMPLOYEE_WHERE,
      ...extraWhere,
    },
  });

export const findActiveEmployees = (extraWhere = {}, select) =>
  prisma.user.findMany({
    where: {
      ...ACTIVE_EMPLOYEE_WHERE,
      ...extraWhere,
    },
    select,
  });
