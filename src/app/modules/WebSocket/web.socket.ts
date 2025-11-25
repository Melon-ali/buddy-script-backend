import { Server } from "http";
import { WebSocket, WebSocketServer } from "ws";
import prisma from "../../../shared/prisma";

interface ExtendedWebSocket extends WebSocket {
  userId?: string;
}

export const onlineUsers = new Map<string, ExtendedWebSocket>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server });
  console.log("WebSocket server running...");

  wss.on("connection", (ws: ExtendedWebSocket) => {
    console.log("New user connected");

    ws.on("message", async (rawData) => {
      try {
        const data = JSON.parse(rawData.toString());

        switch (data.event) {
          // ======================
          // AUTHENTICATE
          // ======================
          case "authenticate": {
            const { userId } = data;
            if (!userId) return ws.close();

            ws.userId = userId;
            onlineUsers.set(userId, ws);

            broadcastAll({
              event: "online_users",
              data: Array.from(onlineUsers.keys()),
            });
            break;
          }

          // ======================
          // SEND MESSAGE
          // ======================
          case "send_message": {
            const { senderId, receiverId, roomId, content } = data;
            if (!senderId || !roomId || !content) return;

            const message = await prisma.message.create({
              data: { senderId, receiverId, roomId, content },
              include: { sender: true },
            });

            // Send to all users in the room
            broadcastRoom(roomId, { event: "new_message", data: message });
            break;
          }

          // ======================
          // TYPING
          // ======================
          case "typing": {
            const { roomId, user } = data;
            broadcastRoom(roomId, { event: "typing", data: user }, ws.userId);
            break;
          }

          case "stop_typing": {
            const { roomId } = data;
            broadcastRoom(roomId, { event: "stop_typing" }, ws.userId);
            break;
          }

          // ======================
          // CALL SIGNALING
          // ======================
          case "call_user": {
            const { callerId, receiverId, roomId, callType } = data;

            const call = await prisma.call.create({
              data: { callerId, receiverId, roomId, callType, status: "PENDING" },
            });

            const receiverSocket = onlineUsers.get(receiverId);
            if (receiverSocket) {
              receiverSocket.send(JSON.stringify({ event: "incoming_call", data: call }));
            }
            break;
          }

          case "accept_call": {
            const { callId } = data;
            const call = await prisma.call.update({
              where: { id: callId },
              data: { status: "ACCEPTED", startedAt: new Date() },
            });

            const callerSocket = onlineUsers.get(call.callerId);
            if (callerSocket) {
              callerSocket.send(JSON.stringify({ event: "call_accepted", data: call }));
            }
            break;
          }

          case "reject_call": {
            const { callId } = data;
            const call = await prisma.call.update({
              where: { id: callId },
              data: { status: "REJECTED", endedAt: new Date() },
            });

            const callerSocket = onlineUsers.get(call.callerId);
            if (callerSocket) {
              callerSocket.send(JSON.stringify({ event: "call_rejected", data: call }));
            }
            break;
          }

          case "end_call": {
            const { callId } = data;
            const call = await prisma.call.update({
              where: { id: callId },
              data: { status: "ENDED", endedAt: new Date() },
            });

            const callerSocket = onlineUsers.get(call.callerId);
            const receiverSocket = onlineUsers.get(call.receiverId);

            if (callerSocket) callerSocket.send(JSON.stringify({ event: "call_ended", data: call }));
            if (receiverSocket) receiverSocket.send(JSON.stringify({ event: "call_ended", data: call }));
            break;
          }

          default:
            console.log("Unknown event:", data.event);
        }
      } catch (err) {
        console.error("WebSocket error:", err);
      }
    });

    ws.on("close", () => {
      if (ws.userId) {
        onlineUsers.delete(ws.userId);
        broadcastAll({
          event: "online_users",
          data: Array.from(onlineUsers.keys()),
        });
      }
      console.log("User disconnected");
    });
  });

  return wss;
}

// ======================
// HELPERS
// ======================
function broadcastAll(message: object) {
  onlineUsers.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  });
}

function broadcastRoom(roomId: string, message: object, exceptUserId?: string) {
  onlineUsers.forEach((ws, userId) => {
    if (ws.readyState === WebSocket.OPEN && userId !== exceptUserId) {
      ws.send(JSON.stringify({ ...message, roomId }));
    }
  });
}
