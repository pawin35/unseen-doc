-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "docType" TEXT NOT NULL,
    "docNumber" TEXT NOT NULL,
    "issueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "customerId" TEXT,
    "custName" TEXT NOT NULL,
    "custAddress" TEXT NOT NULL,
    "custTaxId" TEXT,
    "custBranchType" TEXT NOT NULL DEFAULT 'HEAD_OFFICE',
    "custBranchCode" TEXT,
    "custContactPerson" TEXT,
    "custPhone" TEXT,
    "custEmail" TEXT,
    "custSignatoryName" TEXT,
    "sellerSignatoryName" TEXT,
    "showSignatureImage" BOOLEAN NOT NULL DEFAULT true,
    "vatMode" TEXT NOT NULL DEFAULT 'NONE',
    "vatRateBp" INTEGER NOT NULL DEFAULT 700,
    "whtRateBp" INTEGER,
    "docDiscountType" TEXT NOT NULL DEFAULT 'NONE',
    "docDiscountValue" INTEGER NOT NULL DEFAULT 0,
    "subtotalSatang" INTEGER NOT NULL,
    "discountSatang" INTEGER NOT NULL,
    "afterDiscountSatang" INTEGER NOT NULL,
    "vatSatang" INTEGER NOT NULL,
    "grandTotalSatang" INTEGER NOT NULL,
    "whtSatang" INTEGER NOT NULL,
    "payableSatang" INTEGER NOT NULL,
    "bahtText" TEXT NOT NULL,
    "notes" TEXT,
    "templateId" TEXT,
    "templateVersionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "TemplateVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("afterDiscountSatang", "bahtText", "createdAt", "custAddress", "custBranchCode", "custBranchType", "custContactPerson", "custEmail", "custName", "custPhone", "custSignatoryName", "custTaxId", "customerId", "discountSatang", "docDiscountType", "docDiscountValue", "docNumber", "docType", "grandTotalSatang", "id", "issueDate", "notes", "payableSatang", "sellerSignatoryName", "showSignatureImage", "status", "subtotalSatang", "templateVersionId", "updatedAt", "vatMode", "vatRateBp", "vatSatang", "whtRateBp", "whtSatang") SELECT "afterDiscountSatang", "bahtText", "createdAt", "custAddress", "custBranchCode", "custBranchType", "custContactPerson", "custEmail", "custName", "custPhone", "custSignatoryName", "custTaxId", "customerId", "discountSatang", "docDiscountType", "docDiscountValue", "docNumber", "docType", "grandTotalSatang", "id", "issueDate", "notes", "payableSatang", "sellerSignatoryName", "showSignatureImage", "status", "subtotalSatang", "templateVersionId", "updatedAt", "vatMode", "vatRateBp", "vatSatang", "whtRateBp", "whtSatang" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
CREATE INDEX "Document_docType_status_idx" ON "Document"("docType", "status");
CREATE INDEX "Document_issueDate_idx" ON "Document"("issueDate");
CREATE UNIQUE INDEX "Document_docType_docNumber_key" ON "Document"("docType", "docNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
