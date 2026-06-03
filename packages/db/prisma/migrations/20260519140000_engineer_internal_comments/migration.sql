-- AlterEnum
ALTER TYPE "ChatRoomType" ADD VALUE 'COMMENTS';

-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN "metadata" JSONB;
