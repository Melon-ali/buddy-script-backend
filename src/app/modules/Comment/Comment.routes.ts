import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { CommentController } from "./Comment.controller";
import { CommentValidation } from "./Comment.validation";

const router = express.Router();

router.post(
  "/",
  auth(),
  // validateRequest(CommentValidation.createSchema),
  CommentController.createComment
);

router.get("/", auth(), CommentController.getCommentList);

router.get("/:id", auth(), CommentController.getCommentById);

router.put(
  "/:id",
  auth(),
  // validateRequest(CommentValidation.updateSchema),
  CommentController.updateComment
);

router.delete("/:id", auth(), CommentController.deleteComment);

export const CommentRoutes = router;
