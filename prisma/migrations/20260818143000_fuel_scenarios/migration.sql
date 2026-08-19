-- Evolve the previously provisioned fuel_scenarios table. It was initially
-- created outside Prisma Migrate, so this migration preserves any scenario
-- already stored instead of attempting to create the table again.
ALTER TABLE "fuel_scenarios"
  ADD COLUMN "outbound_distance_km" DECIMAL(10,3),
  ADD COLUMN "return_distance_km" DECIMAL(10,3),
  ADD COLUMN "days_per_week" DECIMAL(4,2),
  ADD COLUMN "extra_days" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "extra_margin_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "monthly_distance_km" DECIMAL(10,3),
  ADD COLUMN "suggested_budget" DECIMAL(12,2);

-- The previous UI only held a combined round-trip distance. Preserve its
-- total by assigning half to each direction until the user recalculates it.
UPDATE "fuel_scenarios"
SET
  "outbound_distance_km" = "round_trip_km" / 2,
  "return_distance_km" = "round_trip_km" / 2,
  "days_per_week" = "trips_per_week",
  "monthly_distance_km" = "round_trip_km" * "trips_per_week" * "weeks_per_month",
  "suggested_budget" = CEIL("monthly_cost" / 10) * 10;

ALTER TABLE "fuel_scenarios"
  ALTER COLUMN "outbound_distance_km" SET NOT NULL,
  ALTER COLUMN "return_distance_km" SET NOT NULL,
  ALTER COLUMN "days_per_week" SET NOT NULL,
  ALTER COLUMN "monthly_distance_km" SET NOT NULL,
  ALTER COLUMN "suggested_budget" SET NOT NULL,
  ALTER COLUMN "weeks_per_month" TYPE DECIMAL(4,2) USING "weeks_per_month"::DECIMAL(4,2),
  DROP COLUMN "round_trip_km",
  DROP COLUMN "trips_per_week";
