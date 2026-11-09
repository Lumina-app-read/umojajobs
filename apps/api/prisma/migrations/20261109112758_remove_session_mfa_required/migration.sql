/*
  Warnings:

  - You are about to drop the column `mfa_required` on the `sessions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "sessions" DROP COLUMN "mfa_required";
