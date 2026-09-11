-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "city" TEXT,
ADD COLUMN     "region" TEXT;

-- CreateTable
CREATE TABLE "TelegramCustomer" (
    "id" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "firstName" TEXT,
    "username" TEXT,
    "lang" TEXT NOT NULL DEFAULT 'uz',
    "lastSlug" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramCustomer_telegramId_key" ON "TelegramCustomer"("telegramId");

-- CreateIndex
CREATE INDEX "TelegramCustomer_phone_idx" ON "TelegramCustomer"("phone");
