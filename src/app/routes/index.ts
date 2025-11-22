import express from "express";
import { userRoutes } from "../modules/User/user.route";
import { AuthRoutes } from "../modules/Auth/auth.routes";
import { LikeRouter } from "../modules/Like/like.routes";
import { NotificationRoutes } from "../modules/Notification/Notification.routes";


const router = express.Router();

const moduleRoutes = [
  {
    path: "/users",
    route: userRoutes,
  },
  {
    path: "/auth",
    route: AuthRoutes,
  },
  {
    path: "/like",
    route: LikeRouter,
  },
  {
    path: "/notifications",
    route: NotificationRoutes,
  }

];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;