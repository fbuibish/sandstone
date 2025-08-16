-- CreateTable
CREATE TABLE "public"."DocumentText" (
    "documentId" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "DocumentText_pkey" PRIMARY KEY ("documentId")
);

-- AddForeignKey
ALTER TABLE "public"."DocumentText" ADD CONSTRAINT "DocumentText_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
