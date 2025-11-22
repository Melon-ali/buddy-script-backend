import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { PostController } from "./Post.controller";
import { PostValidation } from "./Post.validation";
import { fileUploader } from "../../../helpars/fileUploader";

const router = express.Router();

router.post(
  "/",
  fileUploader.uploadPostImage,
  auth(),
  // validateRequest(PostValidation.createSchema),
  PostController.createPost
);

router.get("/", auth(), PostController.getPostList);

router.get("/:id", auth(), PostController.getPostById);

router.put(
  "/:id",
  fileUploader.uploadPostImage,
  auth(),
  // validateRequest(PostValidation.updateSchema),
  PostController.updatePost
);

router.delete("/:id", auth(), PostController.deletePost);

export const PostRoutes = router;
