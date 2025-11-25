import httpStatus from "http-status";
import prisma from "../../../shared/prisma";
import ApiError from "../../../errors/ApiErrors";

const createIntoDb = async (data: any) => {
  const { postId, parentId, authorId, content } = data;

  // Check if post exists
  const isPostExist = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!isPostExist) {
    throw new ApiError(httpStatus.NOT_FOUND, "Post not found");
  }

  // Create comment
  const comment = await prisma.comment.create({
    data: {
      postId,
      parentId,
      authorId,
      content,
    },
  });

  // Increment comment count in post
  await prisma.post.update({
    where: { id: postId },
    data: {
      commentCount: {
        increment: 1,
      },
    },
  });

  return comment;
};

const getListFromDb = async () => {
  const result = await prisma.comment.findMany();
  return result;
};

const getByIdFromDb = async (id: string) => {
  const result = await prisma.comment.findUnique({ where: { id } });
  if (!result) {
    throw new Error("comment not found");
  }
  return result;
};

const updateIntoDb = async (id: string, data: any) => {
  const result = await prisma.comment.update({
    where: { id },
    data,
  });
  return result;
};

const deleteItemFromDb = async (id: string) => {
  // Find comment
  const existing = await prisma.comment.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new ApiError(httpStatus.NOT_FOUND, "Comment not found");
  }

  // Count replies under this comment
  const replyCount = await prisma.comment.count({
    where: { parentId: id },
  });

  // Delete replies first
  await prisma.comment.deleteMany({
    where: { parentId: id },
  });

  // Delete main comment
  await prisma.comment.delete({
    where: { id },
  });

  // Decrease comment count = parent + number of replies
  await prisma.post.update({
    where: { id: existing.postId },
    data: {
      commentCount: {
        decrement: replyCount + 1,
      },
    },
  });

  return { message: "Comment deleted successfully" };
};

export const CommentService = {
  createIntoDb,
  getListFromDb,
  getByIdFromDb,
  updateIntoDb,
  deleteItemFromDb,
};
