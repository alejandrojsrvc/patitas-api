ALTER TABLE "inventory_movements"
  ADD COLUMN "actor_user_id" UUID;

CREATE INDEX "idx_inventory_moves_actor_user_id"
  ON "inventory_movements"("actor_user_id");

ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
