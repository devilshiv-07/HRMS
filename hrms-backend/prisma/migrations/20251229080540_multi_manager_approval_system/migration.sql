-- CreateEnum
CREATE TYPE "LeaveApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReimbursementApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "LeaveApproval" (
    "id" TEXT NOT NULL,
    "leaveId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "status" "LeaveApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "actedAt" TIMESTAMP(3),

    CONSTRAINT "LeaveApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReimbursementApproval" (
    "id" TEXT NOT NULL,
    "reimbursementId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "status" "ReimbursementApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "actedAt" TIMESTAMP(3),

    CONSTRAINT "ReimbursementApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeaveApproval_leaveId_managerId_key" ON "LeaveApproval"("leaveId", "managerId");

-- CreateIndex
CREATE UNIQUE INDEX "ReimbursementApproval_reimbursementId_managerId_key" ON "ReimbursementApproval"("reimbursementId", "managerId");

-- AddForeignKey
ALTER TABLE "LeaveApproval" ADD CONSTRAINT "LeaveApproval_leaveId_fkey" FOREIGN KEY ("leaveId") REFERENCES "leaves"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApproval" ADD CONSTRAINT "LeaveApproval_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementApproval" ADD CONSTRAINT "ReimbursementApproval_reimbursementId_fkey" FOREIGN KEY ("reimbursementId") REFERENCES "Reimbursement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementApproval" ADD CONSTRAINT "ReimbursementApproval_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
