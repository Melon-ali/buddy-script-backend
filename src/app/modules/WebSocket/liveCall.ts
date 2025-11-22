import { Server } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { RoomType, UserRole } from "@prisma/client";
import prisma from "../../../shared/prisma";
import { jwtHelpers } from "../../../helpars/jwtHelpers";
import config from "../../../config";
import { notificationService } from "../Notification/Notification.service";

// =============================
// Types & In-Memory Registries
// =============================
interface ExtendedWebSocket extends WebSocket {
  userId?: string;
  userRole?: UserRole;
  userName?: string;
  isAlive?: boolean;
  path?: string;
}

// Currently online users: userId -> {socket, path}
export const onlineUsers = new Map<
  string,
  { socket: ExtendedWebSocket; path: string }
>();

// Active room participants: roomId -> Set of userIds
const roomSockets = new Map<string, Set<string>>();

// Chat functionality: userId -> socket
const userSockets = new Map<string, ExtendedWebSocket>();

// =============================
// Utils
// =============================

/**
 * Send payload to a single WebSocket
 */
function send(ws: ExtendedWebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

/**
 * Send payload to a specific userId
 */
function sendToUser(userId: string, payload: unknown) {
  const conn = onlineUsers.get(userId);
  if (conn?.socket.readyState === WebSocket.OPEN) {
    conn.socket.send(JSON.stringify(payload));
    return true;
  }
  return false;
}

/**
 * Broadcast payload to all users in a room except optionally one user
 */
function broadcastToRoom(
  roomId: string,
  payload: unknown,
  exceptUserId?: string
) {
  const members = roomSockets.get(roomId);
  if (!members) return;
  members.forEach((uid) => {
    if (uid === exceptUserId) return;
    sendToUser(uid, payload);
  });
}

/**
 * Broadcast to all connected users
 */
function broadcastToAll(wss: WebSocketServer, message: object) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

/**
 * Ensure a room exists in DB
 */
async function ensureRoomExists(roomId: string) {
  return await prisma.liveCallsRoom.findUnique({ where: { id: roomId } });
}

// =============================
// WebSocket Server
// =============================
export function setupLiveWebSocket(server: Server, path = "/") {
  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

  server.on("upgrade", (request, socket, head) => {
    if (request.url === path) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  /**
   * Heartbeat for connection liveness
   */
  function heartbeat(ws: ExtendedWebSocket) {
    ws.isAlive = true;
  }

  // Ping-pong heartbeat every 30s
  const interval = setInterval(() => {
    wss.clients.forEach((ws: ExtendedWebSocket) => {
      if (ws.isAlive === false) {
        if (ws.userId) {
          onlineUsers.delete(ws.userId);
          userSockets.delete(ws.userId);
          // Remove from all rooms
          for (const [rid, set] of roomSockets)
            if (set.has(ws.userId)) set.delete(ws.userId);
        }
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(interval));

  // Handle new connection
  wss.on("connection", (ws: ExtendedWebSocket, req) => {
    console.log("New live user connected on", path);
    ws.isAlive = true;
    ws.path = req.url;
    send(ws, { event: "info", message: "Connected. Please authenticate." });
    ws.on("pong", () => heartbeat(ws));

    ws.on("message", async (raw: string) => {
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return send(ws, { event: "error", message: "Invalid JSON" });
      }
      const { event } = parsed || {};

      if (!ws.userId && event !== "authenticate")
        return send(ws, { event: "error", message: "Authenticate first" });

      try {
        switch (event) {
          // =============================
          // AUTHENTICATION
          // =============================
          case "authenticate": {
            const token = parsed.token;
            if (!token)
              return send(ws, { event: "error", message: "Token required" });
            try {
              const user = jwtHelpers.verifyToken(
                token,
                config.jwt.jwt_secret as string
              ) as {
                id: string;
                role: UserRole;
                email: string;
              };

              // Close previous same-path connection
              const existing = onlineUsers.get(user.id);
              if (existing && existing.path === ws.path) {
                try {
                  existing.socket.close();
                } catch {}
                onlineUsers.delete(user.id);
              }

              ws.userId = user.id;
              ws.userRole = user.role;
              ws.userName = user.email;
              onlineUsers.set(user.id, { socket: ws, path: ws.path || "/" });
              userSockets.set(user.id, ws);

              send(ws, {
                event: "authenticated",
                data: { userId: user.id, role: user.role },
              });

              // 2️⃣ Send active participants
              if (ws.userRole === UserRole.USER) {
                // send all active teachers
                const activeTeachers = Array.from(onlineUsers.entries())
                  .filter(([_, v]) => v.socket.userRole === UserRole.TEACHER)
                  .map(([id]) => id);
                send(ws, { event: "activeTeachers", data: activeTeachers });
              }

              if (ws.userRole === UserRole.TEACHER) {
                // send all active students
                const activeStudents = Array.from(onlineUsers.entries())
                  .filter(([_, v]) => v.socket.userRole === UserRole.USER)
                  .map(([id]) => id);
                send(ws, { event: "activeStudents", data: activeStudents });
              }

              // Broadcast user online status for chat functionality
              broadcastToAll(wss, {
                event: "userStatus",
                data: { userId: user.id, isOnline: true },
              });
            } catch {
              send(ws, { event: "error", message: "Invalid token" });
            }
            break;
          }

          // =============================
          // CHAT FUNCTIONALITY
          // =============================
          case "message": {
            const { receiverId, message, timerId } = parsed;

            if (!ws.userId || !receiverId || !message) {
              console.log("Invalid message payload");
              return;
            }

            let room = await prisma.room.findFirst({
              where: {
                OR: [
                  { senderId: ws.userId, receiverId },
                  { senderId: receiverId, receiverId: ws.userId },
                ],
              },
            });

            if (!room) {
              room = await prisma.room.create({
                data: { senderId: ws.userId, receiverId },
              });
            }

            const chat = await prisma.chat.create({
              data: {
                senderId: ws.userId,
                receiverId,
                roomId: room.id,
                message,
                timerId: timerId,
              },
            });

            const receiverSocket = userSockets.get(receiverId);
            if (receiverSocket) {
              receiverSocket.send(
                JSON.stringify({ event: "message", data: chat })
              );
            }
            ws.send(JSON.stringify({ event: "message", data: chat }));
            break;
          }

          case "fetchChats": {
            const { receiverId } = parsed;
            if (!ws.userId) {
              console.log("User not authenticated");
              return;
            }

            const room = await prisma.room.findFirst({
              where: {
                OR: [
                  { senderId: ws.userId, receiverId },
                  { senderId: receiverId, receiverId: ws.userId },
                ],
              },
            });

            if (!room) {
              ws.send(JSON.stringify({ event: "fetchChats", data: [] }));
              return;
            }

            const chats = await prisma.chat.findMany({
              where: { roomId: room.id },
              orderBy: { createdAt: "asc" },
            });

            await prisma.chat.updateMany({
              where: { roomId: room.id, receiverId: ws.userId },
              data: { isRead: true },
            });

            ws.send(
              JSON.stringify({
                event: "fetchChats",
                data: chats,
              })
            );
            break;
          }

          case "onlineUsers": {
            const onlineUserList = Array.from(userSockets.keys());
            const user = await prisma.user.findMany({
              where: { id: { in: onlineUserList } },
              select: {
                id: true,
                email: true,
                role: true,
              },
            });
            ws.send(
              JSON.stringify({
                event: "onlineUsers",
                data: user,
              })
            );
            break;
          }

          case "unReadMessages": {
            const { receiverId } = parsed;
            if (!ws.userId || !receiverId) {
              console.log("Invalid unread messages payload");
              return;
            }

            const room = await prisma.room.findFirst({
              where: {
                OR: [
                  { senderId: ws.userId, receiverId },
                  { senderId: receiverId, receiverId: ws.userId },
                ],
              },
            });

            if (!room) {
              ws.send(JSON.stringify({ event: "noUnreadMessages", data: [] }));
              return;
            }

            const unReadMessages = await prisma.chat.findMany({
              where: { roomId: room.id, isRead: false, receiverId: ws.userId },
            });

            const unReadCount = unReadMessages.length;

            ws.send(
              JSON.stringify({
                event: "unReadMessages",
                data: { messages: unReadMessages, count: unReadCount },
              })
            );
            break;
          }

          case "messageList": {
            try {
              // Fetch all rooms where the user is involved
              const rooms = await prisma.room.findMany({
                where: {
                  OR: [{ senderId: ws.userId }, { receiverId: ws.userId }],
                },
                include: {
                  chat: {
                    orderBy: {
                      createdAt: "desc",
                    },
                    take: 1, // Fetch only the latest message for each room
                  },
                },
              });

              // Extract user IDs, filtering out null
              const userIds = rooms
                .map((room) =>
                  room.senderId === ws.userId ? room.receiverId : room.senderId
                )
                .filter((id): id is string => id !== null && id !== undefined); // ✅ Filter null and undefined

              // Fetch user profiles for valid user IDs
              const userInfos = await prisma.user.findMany({
                where: {
                  id: {
                    in: userIds,
                  },
                },
                select: {
                  profileImage: true,
                  username: true,
                  id: true,
                },
              });

              // Combine user info with their last message
              const userWithLastMessages = rooms.map((room) => {
                const otherUserId =
                  room.senderId === ws.userId ? room.receiverId : room.senderId;
                const userInfo = userInfos.find(
                  (userInfo) => userInfo.id === otherUserId
                );

                return {
                  user: userInfo || null,
                  lastMessage: room.chat[0] || null,
                };
              });

              // Send the result back to the requesting client
              ws.send(
                JSON.stringify({
                  event: "messageList",
                  data: userWithLastMessages,
                })
              );
            } catch (error) {
              console.error(
                "Error fetching user list with last messages:",
                error
              );
              ws.send(
                JSON.stringify({
                  event: "error",
                  message: "Failed to fetch users with last messages",
                })
              );
            }
            break;
          }

          // // -------------------------
          // // GROUP CHAT: create group room
          // // payload: { name?: string, memberIds: string[] }
          // // -------------------------
          // case "createGroup":
          //   {
          //     const { name, memberIds } = parsed;
          //     if (!ws.userId || !Array.isArray(memberIds))
          //       return send(ws, { event: "error", message: "Invalid payload" });

          //     const members = Array.from(new Set([ws.userId, ...memberIds]));

          //     const room = await prisma.room.create({
          //       data: {
          //         type: RoomType.GROUP,
          //         name: name ?? "New Group",
          //         // RoomUser create for each member
          //         RoomUser: {
          //           create: members.map((id: string) => ({ userId: id })),
          //         },
          //       },
          //       include: {
          //         RoomUser: {
          //           include: {
          //             user: {
          //               select: {
          //                 id: true,
          //                 username: true,
          //                 profileImage: true,
          //               },
          //             },
          //           },
          //         },
          //       },
          //     });

          //     // notify members who are online
          //     members.forEach((uid) => {
          //       if (uid !== ws.userId)
          //         sendToUser(uid, {
          //           event: "addedToGroup",
          //           data: { roomId: room.id, name: room.name },
          //         });
          //     });

          //     send(ws, { event: "groupCreated", data: room });
          //     break;
          //   }

          //   // -------------------------
          //   // GROUP CHAT: send message
          //   // payload: { roomId, message }
          //   // -------------------------

          //   async function assertMembership(
          //     roomId: string,
          //     userId: string
          //   ): Promise<boolean> {
          //     const membership = await prisma.roomUser.findFirst({
          //       where: { roomId, userId },
          //     });
          //     return !!membership; // returns true if user is in the room
          //   }

          // case "groupMessage": {
          //   const { roomId, message } = parsed;
          //   if (!ws.userId || !roomId || !message) {
          //     return send(ws, { event: "error", message: "Invalid payload" });
          //   }

          //   // ✅ Verify membership
          //   if (!(await assertMembership(roomId, ws.userId))) {
          //     return send(ws, {
          //       event: "error",
          //       message: "Not a member of this group",
          //     });
          //   }

          //   const chat = await prisma.chat.create({
          //     data: {
          //       senderId: ws.userId,
          //       roomId,
          //       message,
          //     },
          //     include: {
          //       sender: {
          //         select: { id: true, username: true, profileImage: true },
          //       },
          //     },
          //   });

          //   // ✅ Broadcast to all members
          //   const members = await prisma.roomUser.findMany({
          //     where: { roomId },
          //   });
          //   members.forEach((m) => {
          //     sendToUser(m.userId, { event: "groupMessage", data: chat });
          //   });

          //   send(ws, { event: "groupMessage", data: chat });
          //   break;
          // }

          // // -------------------------
          // // GROUP: fetch chats
          // // payload: { roomId }
          // // -------------------------
          // case "fetchGroupChats": {
          //   const { roomId } = parsed;
          //   if (!ws.userId || !roomId)
          //     return send(ws, { event: "error", message: "Invalid payload" });

          //   if (!assertMembership(roomId, ws.userId))
          //     return send(ws, {
          //       event: "error",
          //       message: "Not a member of this group",
          //     });

          //   const chats = await prisma.chat.findMany({
          //     where: { roomId },
          //     orderBy: { createdAt: "asc" },
          //     include: {
          //       sender: {
          //         select: { id: true, username: true, profileImage: true },
          //       },
          //     },
          //   });

          //   send(ws, { event: "fetchGroupChats", data: chats });
          //   break;
          // }

          // // -------------------------
          // // GROUP: list groups current user belongs to
          // // -------------------------
          // case "groupList": {
          //   if (!ws.userId)
          //     return send(ws, { event: "error", message: "Not authenticated" });

          //   const groups = await prisma.room.findMany({
          //     where: {
          //       type: RoomType.GROUP,
          //       RoomUser: { some: { userId: ws.userId } },
          //     },
          //     include: {
          //       RoomUser: {
          //         include: {
          //           user: {
          //             select: { id: true, username: true, profileImage: true },
          //           },
          //         },
          //       },
          //       chat: { orderBy: { createdAt: "desc" }, take: 1 },
          //     },
          //     orderBy: { updatedAt: "desc" },
          //   });

          //   send(ws, { event: "groupList", data: groups });
          //   break;
          // }

          // // -------------------------
          // // CONVERSATION LIST (unified: private + groups)
          // // -------------------------
          // case "conversationList": {
          //   if (!ws.userId)
          //     return send(ws, { event: "error", message: "Not authenticated" });

          //   // Private conversations (rooms with PRIVATE type)
          //   const privateRooms = await prisma.room.findMany({
          //     where: {
          //       type: RoomType.PRIVATE,
          //       OR: [{ senderId: ws.userId }, { receiverId: ws.userId }],
          //     },
          //     include: {
          //       chat: { orderBy: { createdAt: "desc" }, take: 1 },
          //       RoomUser: true,
          //     },
          //   });

          //   // Map to helpful structure (other user + last message)
          //   const privateConvos = await Promise.all(
          //     privateRooms.map(async (room) => {
          //       const otherUserId =
          //         room.senderId === ws.userId ? room.receiverId : room.senderId;
          //       const other = otherUserId
          //         ? await prisma.user.findUnique({
          //             where: { id: otherUserId },
          //             select: { id: true, username: true, profileImage: true },
          //           })
          //         : null;
          //       return {
          //         type: "private",
          //         roomId: room.id,
          //         user: other,
          //         lastMessage: room.chat[0] || null,
          //       };
          //     })
          //   );

          //   // Group conversations
          //   const groupRooms = await prisma.room.findMany({
          //     where: {
          //       type: RoomType.GROUP,
          //       RoomUser: { some: { userId: ws.userId } },
          //     },
          //     include: { chat: { orderBy: { createdAt: "desc" }, take: 1 } },
          //   });

          //   const groupConvos = groupRooms.map((g) => ({
          //     type: "group",
          //     roomId: g.id,
          //     name: (g as any).name || null,
          //     lastMessage: g.chat[0] || null,
          //   }));

          //   send(ws, {
          //     event: "conversationList",
          //     data: [...privateConvos, ...groupConvos],
          //   });
          //   break;
          // }
// -------------------------
          // GROUP CHAT: send message
          // payload: { roomId, message }
          // -------------------------
          case "groupMessage": {
            const { roomId, message } = parsed;
            if (!ws.userId || !roomId || !message) {
              return send(ws, { event: "error", message: "Invalid payload" });
            }

            // ✅ Verify membership
            if (!(await assertMembership(roomId, ws.userId))) {
              return send(ws, {
                event: "error",
                message: "Not a member of this group",
              });
            }

            const chat = await prisma.chat.create({
              data: {
                senderId: ws.userId,
                roomId,
                message,
              },
              include: {
                sender: {
                  select: { id: true, username: true, profileImage: true },
                },
              },
            });

            // ✅ Broadcast to all members
            const members = await prisma.roomUser.findMany({
              where: { roomId },
            });
            members.forEach((m) => {
              sendToUser(m.userId, { event: "groupMessage", data: chat });
            });

            break;
          }

          // -------------------------
          // GROUP: fetch chats
          // payload: { roomId }
          // -------------------------
          case "fetchGroupChats": {
            const { roomId } = parsed;
            if (!ws.userId || !roomId) {
              return send(ws, { event: "error", message: "Invalid payload" });
            }

            if (!(await assertMembership(roomId, ws.userId))) {
              return send(ws, {
                event: "error",
                message: "Not a member of this group",
              });
            }

            const chats = await prisma.chat.findMany({
              where: { roomId },
              orderBy: { createdAt: "asc" },
              include: {
                sender: {
                  select: { id: true, username: true, profileImage: true },
                },
              },
            });

            send(ws, { event: "fetchGroupChats", data: chats });
            break;
          }

          // -------------------------
          // GROUP: list groups current user belongs to
          // -------------------------
          case "groupList": {
            if (!ws.userId) {
              return send(ws, { event: "error", message: "Not authenticated" });
            }

            const groups = await prisma.room.findMany({
              where: {
                type: RoomType.GROUP,
                RoomUser: { some: { userId: ws.userId } },
              },
              include: {
                RoomUser: {
                  include: {
                    user: {
                      select: { id: true, username: true, profileImage: true },
                    },
                  },
                },
                chat: { orderBy: { createdAt: "desc" }, take: 1 },
              },
              orderBy: { updatedAt: "desc" },
            });

            send(ws, { event: "groupList", data: groups });
            break;
          }
          // =============================
          // TEACHER START LIVE
          // =============================
          case "startLive": {
            if (ws.userRole !== UserRole.TEACHER)
              return send(ws, {
                event: "error",
                message: "Only TEACHER can start live",
              });

            const { title = "", description = "" } = parsed;

            const live = await prisma.liveCallsRoom.create({
              data: {
                authorId: ws.userId!,
                title,
                description,
                isLive: true,
              },
            });

            // Add teacher to current + total participants
            await prisma.currentParticipant.create({
              data: { userId: ws.userId!, liveCallsRoomId: live.id },
            });
            await prisma.totalParticipant.create({
              data: { userId: ws.userId!, liveCallsRoomId: live.id },
            });

            roomSockets.set(live.id, new Set([ws.userId!]));

            // ✅ Notify all students
            const students = await prisma.user.findMany({
              where: { role: UserRole.USER },
            });
            for (const student of students) {
              if (student.fcmToken) {
                await notificationService.sendNotification(
                  student.fcmToken,
                  "Live Class Started",
                  title,
                  student.id
                );
              }
            }

            send(ws, {
              event: "liveStarted",
              data: { roomId: live.id, title: live.title },
            });
            break;
          }

          // =============================
          // JOIN LIVE
          // =============================
          case "joinLive": {
            const { roomId } = parsed;
            if (!roomId)
              return send(ws, { event: "error", message: "roomId required" });
            const room = await ensureRoomExists(roomId);
            if (!room || !room.isLive)
              return send(ws, { event: "error", message: "Live not found" });

            if (!roomSockets.has(roomId)) roomSockets.set(roomId, new Set());
            roomSockets.get(roomId)!.add(ws.userId!);

            // // DB relations
            // const currentExists = await prisma.currentParticipant.findFirst({
            //   where: { userId: ws.userId!, liveCallsRoomId: roomId },
            // });
            // if (!currentExists)
            //   await prisma.currentParticipant.create({
            //     data: { userId: ws.userId!, liveCallsRoomId: roomId },
            //   });

            // const totalExists = await prisma.totalParticipant.findFirst({
            //   where: { userId: ws.userId!, liveCallsRoomId: roomId },
            // });
            // if (!totalExists)
            //   await prisma.totalParticipant.create({
            //     data: { userId: ws.userId!, liveCallsRoomId: roomId },
            //   });

            // send(ws, { event: "joinedLive", data: { roomId } });
            // broadcastToRoom(
            //   roomId,
            //   { event: "userJoined", data: { roomId, userId: ws.userId } },
            //   ws.userId
            // );
            // break;

            // DB: current + total participants
            if (
              !(await prisma.currentParticipant.findFirst({
                where: { userId: ws.userId!, liveCallsRoomId: roomId },
              }))
            )
              await prisma.currentParticipant.create({
                data: { userId: ws.userId!, liveCallsRoomId: roomId },
              });
            if (
              !(await prisma.totalParticipant.findFirst({
                where: { userId: ws.userId!, liveCallsRoomId: roomId },
              }))
            )
              await prisma.totalParticipant.create({
                data: { userId: ws.userId!, liveCallsRoomId: roomId },
              });
            // Send joined event to student
            send(ws, { event: "joinedLive", data: { roomId } });

            // Broadcast to teacher + other participants
            broadcastToRoom(
              roomId,
              { event: "userJoinedLive", data: { userId: ws.userId, roomId } },
              ws.userId
            );

            break;
          }

          // =============================
          // LEAVE LIVE
          // =============================
          // case "leaveLive": {
          //   const { roomId } = parsed;
          //   if (!roomId)
          //     return send(ws, { event: "error", message: "roomId required" });

          //   roomSockets.get(roomId)?.delete(ws.userId!);
          //   await prisma.currentParticipant.deleteMany({
          //     where: { userId: ws.userId!, liveCallsRoomId: roomId },
          //   });

          //   send(ws, { event: "leftLive", data: { roomId } });
          //   broadcastToRoom(
          //     roomId,
          //     { event: "userLeft", data: { roomId, userId: ws.userId } },
          //     ws.userId
          //   );
          //   break;
          // }

          case "leaveLive": {
            const { roomId } = parsed;
            if (!roomId)
              return send(ws, { event: "error", message: "roomId required" });

            roomSockets.get(roomId)?.delete(ws.userId!);

            await prisma.currentParticipant.deleteMany({
              where: { userId: ws.userId!, liveCallsRoomId: roomId },
            });

            send(ws, { event: "leftLive", data: { roomId } });
            broadcastToRoom(
              roomId,
              { event: "userLeftLive", data: { userId: ws.userId, roomId } },
              ws.userId
            );

            break;
          }

          // =============================
          // END LIVE
          // =============================
          case "endLive": {
            const { roomId } = parsed;
            if (!roomId)
              return send(ws, { event: "error", message: "roomId required" });
            const room = await prisma.liveCallsRoom.findUnique({
              where: { id: roomId },
              select: { authorId: true, isLive: true },
            });
            if (!room)
              return send(ws, { event: "error", message: "Live not found" });
            if (room.authorId !== ws.userId)
              return send(ws, {
                event: "error",
                message: "Only author can end live",
              });
            if (!room.isLive)
              return send(ws, { event: "error", message: "Already ended" });

            await prisma.liveCallsRoom.update({
              where: { id: roomId },
              data: { isLive: false, endedAt: new Date() },
            });

            await prisma.currentParticipant.deleteMany({
              where: { liveCallsRoomId: roomId },
            });
            roomSockets.delete(roomId);

            send(ws, { event: "liveEnded", data: { roomId } });
            broadcastToRoom(
              roomId,
              { event: "liveEnded", data: { roomId } },
              ws.userId
            );
            break;
          }

          // =============================
          // WebRTC signaling for LIVE
          // Broadcasts to all participants in room except sender
          // =============================
          case "liveOffer":
          case "liveAnswer":
          case "liveIce": {
            const { roomId, offer, answer, candidate } = parsed;
            if (!roomId)
              return send(ws, { event: "error", message: "roomId required" });
            if (!roomSockets.get(roomId)?.has(ws.userId!))
              return send(ws, { event: "error", message: "Join room first" });

            const payload =
              event === "liveOffer"
                ? { event, data: { fromUserId: ws.userId, roomId, offer } }
                : event === "liveAnswer"
                ? { event, data: { fromUserId: ws.userId, roomId, answer } }
                : { event, data: { fromUserId: ws.userId, roomId, candidate } };

            // Broadcast to all in room except sender
            broadcastToRoom(roomId, payload, ws.userId);
            break;
          }

          default:
            send(ws, { event: "error", message: "Unknown event" });
        }
      } catch (err) {
        send(ws, {
          event: "error",
          message: (err as Error)?.message || "Server error",
        });
      }
    });

    // Cleanup on close
    // ws.on("close", async () => {
    //   if (!ws.userId) return;
    //   onlineUsers.delete(ws.userId);
    //   userSockets.delete(ws.userId);
    //   for (const [roomId, set] of roomSockets) {
    //     if (set.has(ws.userId)) {
    //       set.delete(ws.userId);
    //       try {
    //         await prisma.currentParticipant.deleteMany({
    //           where: { userId: ws.userId!, liveCallsRoomId: roomId },
    //         });
    //       } catch {}
    //     }
    //   }

    //   // Broadcast user offline status for chat functionality
    //   broadcastToAll(wss, {
    //     event: "userStatus",
    //     data: { userId: ws.userId, isOnline: false },
    //   });
    // });
    // Inside disconnect / close handler
    ws.on("close", async () => {
      if (!ws.userId) return;

      // Remove user from global online maps
      onlineUsers.delete(ws.userId);
      userSockets.delete(ws.userId);

      // Remove user from all live rooms
      for (const [roomId, set] of roomSockets) {
        if (set.has(ws.userId)) {
          set.delete(ws.userId);

          try {
            await prisma.currentParticipant.deleteMany({
              where: { userId: ws.userId, liveCallsRoomId: roomId },
            });
          } catch (err) {
            console.error("Error deleting currentParticipant:", err);
          }

          // Notify other participants in the room
          broadcastToRoom(roomId, {
            event: "userLeftLive",
            data: { userId: ws.userId, roomId },
          });
        }
      }

      // Broadcast offline status globally
      broadcastToAll(wss, {
        event: "userStatus",
        data: { userId: ws.userId, role: ws.userRole, isOnline: false },
      });
    });
  });

  return wss;
}
async function assertMembership(roomId: string, userId: string): Promise<boolean> {
  const membership = await prisma.roomUser.findFirst({
    where: { roomId, userId },
  });
  return !!membership;
}
