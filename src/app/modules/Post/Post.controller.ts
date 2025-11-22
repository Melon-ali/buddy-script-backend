import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { PostService } from "./Post.service";
import { Request, Response } from "express";

const createPost = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
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
  const userId = req.user?.id;

  const result = await PostService.deleteItemFromDb({ postId, userId });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Post deleted successfully",
    data: result,
  });
});

export const PostController = {
  createPost,
  getPostList,
  getPostById,
  updatePost,
  deletePost,
};
