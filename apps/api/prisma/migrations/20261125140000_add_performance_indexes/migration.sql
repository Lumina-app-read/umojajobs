-- CreateIndex
CREATE INDEX "commissions_created_at_id_idx" ON "commissions"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "credit_orders_created_at_id_idx" ON "credit_orders"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "job_offers_category_id_status_idx" ON "job_offers"("category_id", "status");

-- CreateIndex
CREATE INDEX "job_offers_city_id_status_idx" ON "job_offers"("city_id", "status");

-- CreateIndex
CREATE INDEX "job_offers_status_expired_at_idx" ON "job_offers"("status", "expired_at" DESC);

-- CreateIndex
CREATE INDEX "job_unlocks_created_at_id_idx" ON "job_unlocks"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "users_created_at_id_idx" ON "users"("created_at" DESC, "id" DESC);

