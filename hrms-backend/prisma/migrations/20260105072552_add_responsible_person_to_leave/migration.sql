-- AlterTable
ALTER TABLE "leaves" ADD COLUMN     "responsiblePersonId" TEXT;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_responsiblePersonId_fkey" FOREIGN KEY ("responsiblePersonId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
