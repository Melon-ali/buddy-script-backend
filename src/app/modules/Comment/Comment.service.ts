import httpStatus from "http-status";
import prisma from "../../../shared/prisma";
import ApiError from "../../../errors/ApiErrors";


const createIntoDb = async (data: any) => {
  const { postId, parentId } = data;

  // Check if post exists
  const isPostExist = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!isPostExist) {
    throw new ApiError(httpStatus.NOT_FOUND, "Post not found");
  }

  // If parentId is provided → this is a reply
  if (parentId) {
    const parentComment = await prisma.comment.findUnique({
      where: { id: parentId },
    });

    if (!parentComment) {
      throw new ApiError(httpStatus.NOT_FOUND, "Parent comment not found");
    }

    // Validate: parent comment belongs to the same post
    if (parentComment.postId !== postId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Reply must be on the same post"
      );
    }
  }

  // Create comment or reply
  const result = await prisma.comment.create({
    data,
    include: {
      author: true, // optional
    },
  });

  return result;
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
  // 1. delete child replies first
  await prisma.comment.deleteMany({
    where: { parentId: id },
  });

  // 2. delete the parent comment
  const deleted = await prisma.comment.delete({
    where: { id },
  });

  return deleted;
};
export const CommentService = {
  createIntoDb,
  getListFromDb,
  getByIdFromDb,
  updateIntoDb,
  deleteItemFromDb,
};
