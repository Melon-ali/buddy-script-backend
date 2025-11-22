import express from "express";
import { userRoutes } from "../modules/User/user.route";
import { AuthRoutes } from "../modules/Auth/auth.routes";
import { LikeRouter } from "../modules/Like/like.routes";
import { NotificationRoutes } from "../modules/Notification/Notification.routes";
import { PostRoutes } from "../modules/Post/Post.routes";
import { CommentRoutes } from "../modules/Comment/Comment.routes";


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
    path: "/posts",
    route: PostRoutes,
  },
  {
    path: "/likes",
    route: LikeRouter,
  },
  {
    path: "/comments",
    route: CommentRoutes,
  },
  {
    path: "/notifications",
    route: NotificationRoutes,
  }

];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;