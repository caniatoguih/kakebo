CREATE TABLE "fuel_prices" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "fuel_type" TEXT NOT NULL,
    "price_per_l" DECIMAL(10,3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fuel_prices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fuel_prices_usuario_id_fuel_type_key" ON "fuel_prices"("usuario_id", "fuel_type");
ALTER TABLE "fuel_prices" ADD CONSTRAINT "fuel_prices_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
