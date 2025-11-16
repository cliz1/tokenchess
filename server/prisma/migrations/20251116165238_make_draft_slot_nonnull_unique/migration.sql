/*
  Warnings:

  - Made the column `slot` on table `Draft` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."Draft" ALTER COLUMN "slot" SET NOT NULL;
