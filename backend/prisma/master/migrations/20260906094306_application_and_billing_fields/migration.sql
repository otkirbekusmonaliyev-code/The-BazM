/*
  Warnings:

  - You are about to drop the column `ownerName` on the `RestaurantApplication` table. All the data in the column will be lost.
  - Added the required column `region` to the `RestaurantApplication` table without a default value. This is not possible if the table is not empty.
  - Made the column `city` on table `RestaurantApplication` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('restaurant', 'cafe');

-- AlterTable
ALTER TABLE "RestaurantApplication" DROP COLUMN "ownerName",
ADD COLUMN     "businessType" "BusinessType" NOT NULL DEFAULT 'restaurant',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "region" TEXT NOT NULL,
ADD COLUMN     "restaurantId" TEXT,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "city" SET NOT NULL;
