ALTER TABLE "fuel_scenarios"
  ADD COLUMN "origin_label" TEXT,
  ADD COLUMN "origin_lat" DECIMAL(10,7),
  ADD COLUMN "origin_lng" DECIMAL(10,7),
  ADD COLUMN "destination_label" TEXT,
  ADD COLUMN "destination_lat" DECIMAL(10,7),
  ADD COLUMN "destination_lng" DECIMAL(10,7),
  ADD COLUMN "outbound_duration_min" DECIMAL(8,2),
  ADD COLUMN "return_duration_min" DECIMAL(8,2);
