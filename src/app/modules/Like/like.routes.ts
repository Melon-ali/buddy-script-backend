import { Router } from "express";
import { fileUploader } from "../../../helpars/fileUploader";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { likeController } from "./like.controller";

const router = Router();

router.post(
  "/:id",
  auth(UserRole.SUPER_ADMIN, UserRole.STUDENT, UserRole.TEACHER),
  likeController.toggleLike
);
// get all my like id

router.get(
  "/",
  auth(UserRole.SUPER_ADMIN, UserRole.STUDENT, UserRole.TEACHER),
  likeController.getAllMyLikeIds
);

router.delete(
  "/unlike/:id",
  auth(UserRole.SUPER_ADMIN, UserRole.STUDENT, UserRole.TEACHER),
  likeController.unlike
);

export const LikeRouter = router;
