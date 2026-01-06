-- AlterTable
ALTER TABLE "Workday" ADD COLUMN "projectId" TEXT;

-- CreateIndex
CREATE INDEX "Workday_projectId_idx" ON "Workday"("projectId");

-- AddForeignKey
ALTER TABLE "Workday" ADD CONSTRAINT "Workday_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

