-- CreateTable
CREATE TABLE "Company" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "branchType" TEXT NOT NULL DEFAULT 'HEAD_OFFICE',
    "branchCode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "logoPath" TEXT,
    "signaturePath" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "taxId" TEXT,
    "branchType" TEXT NOT NULL DEFAULT 'HEAD_OFFICE',
    "branchCode" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Document" (
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
    "templateVersionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "TemplateVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "qtyThousandths" INTEGER NOT NULL,
    "unit" TEXT,
    "unitPriceSatang" INTEGER NOT NULL,
    "discountType" TEXT NOT NULL DEFAULT 'NONE',
    "discountValue" INTEGER NOT NULL DEFAULT 0,
    "lineTotalSatang" INTEGER NOT NULL,
    CONSTRAINT "DocumentLine_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "docType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "activeVersionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Template_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "TemplateVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TemplateVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NumberingSetting" (
    "docType" TEXT NOT NULL PRIMARY KEY,
    "pattern" TEXT NOT NULL,
    "padding" INTEGER NOT NULL DEFAULT 4
);

-- CreateTable
CREATE TABLE "NumberingCounter" (
    "docType" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("docType", "dateKey")
);

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE INDEX "Document_docType_status_idx" ON "Document"("docType", "status");

-- CreateIndex
CREATE INDEX "Document_issueDate_idx" ON "Document"("issueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Document_docType_docNumber_key" ON "Document"("docType", "docNumber");

-- CreateIndex
CREATE INDEX "DocumentLine_documentId_sortOrder_idx" ON "DocumentLine"("documentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Template_activeVersionId_key" ON "Template"("activeVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Template_docType_name_key" ON "Template"("docType", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateVersion_templateId_versionNo_key" ON "TemplateVersion"("templateId", "versionNo");
