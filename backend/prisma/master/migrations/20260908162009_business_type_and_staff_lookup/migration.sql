-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "businessType" "BusinessType" NOT NULL DEFAULT 'restaurant';

-- CreateTable
CREATE TABLE "StaffLookup" (
    "phone" TEXT NOT NULL,
    "restaurantSlug" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffLookup_pkey" PRIMARY KEY ("phone")
);

-- CreateIndex
CREATE INDEX "StaffLookup_restaurantSlug_idx" ON "StaffLookup"("restaurantSlug");
