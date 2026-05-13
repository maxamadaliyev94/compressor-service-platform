-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "editedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "chat_room_read_states" (
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_room_read_states_pkey" PRIMARY KEY ("userId","roomId")
);

-- CreateTable
CREATE TABLE "chat_room_hiddens" (
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_room_hiddens_pkey" PRIMARY KEY ("userId","roomId")
);

-- AddForeignKey
ALTER TABLE "chat_room_read_states" ADD CONSTRAINT "chat_room_read_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_room_read_states" ADD CONSTRAINT "chat_room_read_states_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_room_hiddens" ADD CONSTRAINT "chat_room_hiddens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_room_hiddens" ADD CONSTRAINT "chat_room_hiddens_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
