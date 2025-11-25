import { Server } from "http";
import config from "./config";
import cron from "node-cron";
import prisma from "./shared/prisma";
import app from "./app";
import cors from "cors";
import { setupWebSocket } from "./app/modules/WebSocket/web.socket";

let server: Server;

async function startServer() {
  server = app.listen(config.port, async () => {
    console.log("Server is listiening on port ", config.port);

    await setupWebSocket(server);
    // console.log("WebSocket server is running");
  });
}

app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
}));

async function main() {
  await startServer();
  const exitHandler = () => {
    if (server) {
      server.close(() => {
        console.info("Server closed!");
        restartServer();
      });
    } else {
      process.exit(1);
    }
  };

  const restartServer = () => {
    console.info("Restarting server...");
    main();
  };

  process.on("uncaughtException", (error) => {
    console.log("Uncaught Exception: ", error);
    exitHandler();
  });

  process.on("unhandledRejection", (error) => {
    console.log("Unhandled Rejection: ", error);
    exitHandler();
  });

  // Handling the server shutdown with SIGTERM and SIGINT
  process.on("SIGTERM", () => {
    console.log("SIGTERM signal received. Shutting down gracefully...");
    exitHandler();
  });

  process.on("SIGINT", () => {
    console.log("SIGINT signal received. Shutting down gracefully...");
    exitHandler();
  });
}

main();
