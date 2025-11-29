import httpStatus from "http-status";
import prisma from "../../../shared/prisma";
import ApiError from "../../../errors/ApiErrors";

interface CreateCommentData {
  postId: string;
  content: string;
  parentId?: string | null;
  authorId: string; // token থেকে নেওয়া হবে
}

const createIntoDb = async (data: {
  postId: string;
  parentId?: string | null;
  authorId: string;
  content: string;
}) => {
  const { postId, parentId = null, authorId, content } = data;

  if (!content || !content.trim()) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Comment content cannot be empty");
  }

  // Check if post exists
  const isPostExist = await prisma.post.findUnique({ where: { id: postId } });
  if (!isPostExist) {
    throw new ApiError(httpStatus.NOT_FOUND, "Post not found");
  }

  // Create comment using direct fields only
  const comment = await prisma.comment.create({
    data: {
      postId,
      parentId,
      authorId,
      content,
    },
    include: { author: true }, // include author details if needed
  });

  // Increment post comment count
  await prisma.post.update({
    where: { id: postId },
    data: { commentCount: { increment: 1 } },
  });

  return comment;
};


const getListFromDb = async (postId?: string) => {
  return prisma.comment.findMany({
    where: postId ? { postId } : undefined,
    include: { author: true },
    orderBy: { createdAt: "desc" },
  });
};

const getByIdFromDb = async (id: string) => {
  const comment = await prisma.comment.findUnique({ where: { id }, include: { author: true } });
  if (!comment) throw new ApiError(httpStatus.NOT_FOUND, "Comment not found");
  return comment;
};

const updateIntoDb = async (id: string, data: { content?: string }) => {
  if (data.content && !data.content.trim()) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Content cannot be empty");
  }
  const existing = await prisma.comment.findUnique({ where: { id } });
  if (!existing) throw new ApiError(httpStatus.NOT_FOUND, "Comment not found");

  return prisma.comment.update({
    where: { id },
    data,
    include: { author: true },
  });
};

const deleteItemFromDb = async (id: string) => {
  const existing = await prisma.comment.findUnique({ where: { id } });
  if (!existing) throw new ApiError(httpStatus.NOT_FOUND, "Comment not found");

  const replyCount = await prisma.comment.count({ where: { parentId: id } });
  await prisma.comment.deleteMany({ where: { parentId: id } });
  await prisma.comment.delete({ where: { id } });

  await prisma.post.update({
    where: { id: existing.postId },
    data: { commentCount: { decrement: replyCount + 1 } },
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
