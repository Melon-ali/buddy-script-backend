import { Request, Response } from "express";
import httpStatus from "http-status";
import { CommentService } from "./Comment.service";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";

const createComment = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const authorId = req.user!.id; // token থেকে authorId
  const { postId, content } = req.body;

  const result = await CommentService.createIntoDb({ postId, content, authorId });
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Comment created successfully",
    data: result,
  });
});


const getCommentList = catchAsync(async (req: Request, res: Response) => {
  const postId = req.query.postId as string | undefined;
  const result = await CommentService.getListFromDb(postId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Comment list retrieved successfully",
    data: result,
  });
});

const getCommentById = catchAsync(async (req: Request, res: Response) => {
  const result = await CommentService.getByIdFromDb(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Comment details retrieved successfully",
    data: result,
  });
});

const updateComment = catchAsync(async (req: Request, res: Response) => {
  const result = await CommentService.updateIntoDb(req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Comment updated successfully",
    data: result,
  });
});

const deleteComment = catchAsync(async (req: Request, res: Response) => {
  const result = await CommentService.deleteItemFromDb(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Comment deleted successfully",
    data: result,
  });
});

export const CommentController = {
  createComment,
  getCommentList,
  getCommentById,
  updateComment,
  deleteComment,
};
