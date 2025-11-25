import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { PostService } from "./Post.service";
import { Request, Response } from "express";
import prisma from "../../../shared/prisma";

const createPost = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as { id?: string })?.id;
  const reqBody = req.body;

  const result = await PostService.createIntoDb({
    userId: userId as string,
    reqBody,
    files: req.files as { [fieldname: string]: Express.Multer.File[] },
  });
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Post created successfully",
    data: result,
  });
});

const getPostList = catchAsync(async (req: Request, res: Response) => {
  const result = await PostService.getListFromDb();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Post list retrieved successfully",
    data: result,
  });
});

const getPostById = catchAsync(async (req: Request, res: Response) => {
  const result = await PostService.getByIdFromDb(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Post details retrieved successfully",
    data: result,
  });
});

const updatePost = catchAsync(async (req: Request, res: Response) => {
  const postId = req.params.id;

  const result = await PostService.updateIntoDb({
    postId,
    reqBody: req.body,
    files: req.files as { [fieldname: string]: Express.Multer.File[] },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Post updated successfully",
    data: result,
  });
});

const deletePost = catchAsync(async (req: Request, res: Response) => {
  const postId = req.params.id;
  const userId = (req.user as { id?: string })?.id;

  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User not authenticated",
      data: null,
    });
  }

  // Step 1: Check if post exists and belongs to this user
  const existingPost = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!existingPost) {
    return sendResponse(res, {
      statusCode: httpStatus.NOT_FOUND,
      success: false,
      message: "Post not found",
      data: null,
    });
  }

  if (existingPost.authorId !== userId) {
    return sendResponse(res, {
      statusCode: httpStatus.FORBIDDEN,
      success: false,
      message: "You are not allowed to delete this post",
      data: null,
    });
  }

  // Step 2: Delete all comments under this post
  await prisma.comment.deleteMany({
    where: { postId },
  });

  // Step 3: Delete all likes under this post
  await prisma.like.deleteMany({
    where: { postId },
  });

  // Step 4: Delete the post itself
  const deletedPost = await prisma.post.delete({
    where: { id: postId },
  });

  // Step 5: Send response
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Post deleted successfully",
    data: deletedPost,
  });
});


export const PostController = {
  createPost,
  getPostList,
  getPostById,
  updatePost,
  deletePost,
};
