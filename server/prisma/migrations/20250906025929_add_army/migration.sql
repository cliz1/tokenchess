/*
  Warnings:

  - You are about to drop the `Deck` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Deck" DROP CONSTRAINT "Deck_userId_fkey";

-- DropTable
DROP TABLE "public"."Deck";

-- CreateTable
CREATE TABLE "public"."Army" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Army_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Army_userId_idx" ON "public"."Army"("userId");

-- AddForeignKey
ALTER TABLE "public"."Army" ADD CONSTRAINT "Army_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
