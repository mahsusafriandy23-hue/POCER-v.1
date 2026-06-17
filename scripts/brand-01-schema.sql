-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "brand_id" INTEGER;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "brand_id" INTEGER;

-- AlterTable
ALTER TABLE "qris_accounts" ADD COLUMN     "brand_id" INTEGER;

-- AlterTable
ALTER TABLE "servers" ADD COLUMN     "brand_id" INTEGER;

-- CreateTable
CREATE TABLE "brands" (
    "id" SERIAL NOT NULL,
    "owner_admin_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE INDEX "brands_owner_admin_id_idx" ON "brands"("owner_admin_id");

-- CreateIndex
CREATE INDEX "agents_brand_id_idx" ON "agents"("brand_id");

-- CreateIndex
CREATE INDEX "customers_brand_id_idx" ON "customers"("brand_id");

-- CreateIndex
CREATE INDEX "qris_accounts_brand_id_idx" ON "qris_accounts"("brand_id");

-- CreateIndex
CREATE INDEX "servers_brand_id_idx" ON "servers"("brand_id");

-- AddForeignKey
ALTER TABLE "servers" ADD CONSTRAINT "servers_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_owner_admin_id_fkey" FOREIGN KEY ("owner_admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qris_accounts" ADD CONSTRAINT "qris_accounts_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

