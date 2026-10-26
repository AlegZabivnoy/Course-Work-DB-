-- CreateEnum
CREATE TYPE "part_type" AS ENUM ('screen', 'battery', 'camera', 'back_cover', 'charging_port', 'speaker', 'other');

-- CreateEnum
CREATE TYPE "repair_status" AS ENUM ('received', 'diagnosing', 'in_repair', 'ready', 'issued', 'cancelled');

-- CreateEnum
CREATE TYPE "shop_order_status" AS ENUM ('new', 'paid', 'shipped', 'cancelled');

-- CreateTable
CREATE TABLE "brands" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_models" (
    "id" SERIAL NOT NULL,
    "brand_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "release_year" SMALLINT,

    CONSTRAINT "device_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technicians" (
    "id" SERIAL NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "hired_at" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "model_id" INTEGER NOT NULL,
    "serial_number" VARCHAR(50) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts" (
    "id" SERIAL NOT NULL,
    "sku" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "part_type" "part_type" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "stock_qty" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_compatibility" (
    "part_id" INTEGER NOT NULL,
    "model_id" INTEGER NOT NULL,

    CONSTRAINT "part_compatibility_pkey" PRIMARY KEY ("part_id","model_id")
);

-- CreateTable
CREATE TABLE "repair_orders" (
    "id" SERIAL NOT NULL,
    "device_id" INTEGER NOT NULL,
    "technician_id" INTEGER,
    "status" "repair_status" NOT NULL DEFAULT 'received',
    "problem_description" TEXT NOT NULL,
    "labor_cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "repair_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_order_parts" (
    "order_id" INTEGER NOT NULL,
    "part_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "repair_order_parts_pkey" PRIMARY KEY ("order_id","part_id")
);

-- CreateTable
CREATE TABLE "shop_orders" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "status" "shop_order_status" NOT NULL DEFAULT 'new',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_order_items" (
    "order_id" INTEGER NOT NULL,
    "part_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "shop_order_items_pkey" PRIMARY KEY ("order_id","part_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brands_name_key" ON "brands"("name");

-- CreateIndex
CREATE UNIQUE INDEX "device_models_brand_id_name_key" ON "device_models"("brand_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "devices_serial_number_key" ON "devices"("serial_number");

-- CreateIndex
CREATE INDEX "devices_customer_id_idx" ON "devices"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "parts_sku_key" ON "parts"("sku");

-- CreateIndex
CREATE INDEX "parts_part_type_idx" ON "parts"("part_type");

-- CreateIndex
CREATE INDEX "repair_orders_status_created_at_idx" ON "repair_orders"("status", "created_at");

-- CreateIndex
CREATE INDEX "repair_orders_device_id_idx" ON "repair_orders"("device_id");

-- CreateIndex
CREATE INDEX "shop_orders_customer_id_created_at_idx" ON "shop_orders"("customer_id", "created_at");

-- AddForeignKey
ALTER TABLE "device_models" ADD CONSTRAINT "device_models_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "device_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_compatibility" ADD CONSTRAINT "part_compatibility_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_compatibility" ADD CONSTRAINT "part_compatibility_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "device_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_orders" ADD CONSTRAINT "repair_orders_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_orders" ADD CONSTRAINT "repair_orders_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_order_parts" ADD CONSTRAINT "repair_order_parts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "repair_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_order_parts" ADD CONSTRAINT "repair_order_parts_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_orders" ADD CONSTRAINT "shop_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_order_items" ADD CONSTRAINT "shop_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "shop_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_order_items" ADD CONSTRAINT "shop_order_items_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK constraints

-- device_models
ALTER TABLE "device_models"
    ADD CONSTRAINT "chk_device_models_release_year"
        CHECK ("release_year" BETWEEN 2007 AND 2100);

-- customers
ALTER TABLE "customers"
    ADD CONSTRAINT "chk_customers_phone_format"
        CHECK ("phone" ~ '^\+?[0-9]{10,15}$');

ALTER TABLE "customers"
    ADD CONSTRAINT "chk_customers_email_format"
        CHECK ("email" ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

ALTER TABLE "customers"
    ADD CONSTRAINT "chk_customers_deleted_after_created"
        CHECK ("deleted_at" IS NULL OR "deleted_at" >= "created_at");

-- parts
ALTER TABLE "parts"
    ADD CONSTRAINT "chk_parts_price_positive"
        CHECK ("price" > 0);

ALTER TABLE "parts"
    ADD CONSTRAINT "chk_parts_stock_non_negative"
        CHECK ("stock_qty" >= 0);

-- repair_orders
ALTER TABLE "repair_orders"
    ADD CONSTRAINT "chk_repair_orders_labor_cost_non_negative"
        CHECK ("labor_cost" >= 0);

ALTER TABLE "repair_orders"
    ADD CONSTRAINT "chk_repair_orders_completed_after_created"
        CHECK ("completed_at" IS NULL OR "completed_at" >= "created_at");

ALTER TABLE "repair_orders"
    ADD CONSTRAINT "chk_repair_orders_completed_when_done"
        CHECK ("status" NOT IN ('ready', 'issued') OR "completed_at" IS NOT NULL);

-- repair_order_parts
ALTER TABLE "repair_order_parts"
    ADD CONSTRAINT "chk_repair_order_parts_quantity_positive"
        CHECK ("quantity" > 0);

ALTER TABLE "repair_order_parts"
    ADD CONSTRAINT "chk_repair_order_parts_price_non_negative"
        CHECK ("unit_price" >= 0);

-- shop_order_items
ALTER TABLE "shop_order_items"
    ADD CONSTRAINT "chk_shop_order_items_quantity_positive"
        CHECK ("quantity" > 0);

ALTER TABLE "shop_order_items"
    ADD CONSTRAINT "chk_shop_order_items_price_non_negative"
        CHECK ("unit_price" >= 0);