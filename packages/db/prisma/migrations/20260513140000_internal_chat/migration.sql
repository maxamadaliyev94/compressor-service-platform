-- CreateEnum
CREATE TYPE "ChatRoomType" AS ENUM ('GENERAL', 'DIRECT', 'TASK');

-- CreateTable
CREATE TABLE "chat_rooms" (
    "id" TEXT NOT NULL,
    "type" "ChatRoomType" NOT NULL,
    "dmKey" TEXT,
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_rooms_dmKey_key" ON "chat_rooms"("dmKey");

-- CreateIndex
CREATE UNIQUE INDEX "chat_rooms_taskId_key" ON "chat_rooms"("taskId");

-- CreateIndex
CREATE INDEX "chat_rooms_type_idx" ON "chat_rooms"("type");

-- CreateIndex
CREATE INDEX "chat_messages_roomId_createdAt_idx" ON "chat_messages"("roomId", "createdAt");

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "service_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
