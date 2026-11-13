-- AlterTable
ALTER TABLE "ai_requests" ADD COLUMN     "provider_request_id" VARCHAR(100),
ADD COLUMN     "provider_response_id" VARCHAR(100),
ADD COLUMN     "response_model" VARCHAR(80);

