// Master DB uchun yagona Prisma client (butun ilova davomida bitta instance)

const { PrismaClient } = require('../../node_modules/.prisma/master-client');

const masterPrisma = new PrismaClient();

module.exports = masterPrisma;
