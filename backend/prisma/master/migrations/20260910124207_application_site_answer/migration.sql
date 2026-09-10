-- AlterTable
ALTER TABLE "RestaurantApplication" ADD COLUMN     "adminPasswordEnc" TEXT,
ADD COLUMN     "credentialsSeenAt" TIMESTAMP(3),
ADD COLUMN     "reviewNote" TEXT;
