import httpStatus from "http-status";
import prisma from "../../../shared/prisma";
import ApiError from "../../../errors/ApiErrors";
import { JwtPayload } from "jsonwebtoken";
import { notificationService } from "../Notification/Notification.service";

const likePost = async (id: string, user: any) => {
  const prismaTransaction = await prisma.$transaction(async (prisma) => {
    // Check if the course exists
    const isPostExist = await prisma.post.findUnique({
      where: {
        id: id,
      },
    });

    if (!isPostExist) {
      throw new ApiError(httpStatus.NOT_FOUND, "Post not found");
    }

    // Check if the like already exists
    const existingLike = await prisma.like.findFirst({
      where: {
        userId: user.id,
        postId: id,
      },
    });

    if (existingLike) {
      // Already liked - you can either:
      // - Do nothing
      // - Throw an error
      // - Return a message
      // Here, we'll throw an error:
      throw new ApiError(httpStatus.BAD_REQUEST, "Post already liked");
    }

    // Create the like
    const result = await prisma.like.create({
      data: {
        userId: user.id,
        postId: id,
      },
    });

    // Increment like count
    await prisma.post.update({
      where: {
        id: id,
      },
      data: {
        likeCount: {
          increment: 1,
        },
      },
    });

    // Send notification
    if (user.fcmToken) {
      const message = {
        token: user.fcmToken,
        title: "Liked a course",
        body: "You liked a course",
        userId: user.id,
      };

      await notificationService.sendNotification(
        message.token,
        message.title,
        message.body,
        message.userId
      );
    }

    return result;
  });

  return prismaTransaction;
};


const unlike = async (id: string, user: any) => {
  const isPostExist = await prisma.post.findUnique({
    where: { id },
  });

  if (!isPostExist) {
    throw new ApiError(httpStatus.NOT_FOUND, "Post not found");
  }

  const existingLike = await prisma.like.findFirst({
    where: {
      userId: user.id,
      postId: id,
    },
  });

  if (!existingLike) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Like does not exist");
  }

  await prisma.like.delete({
    where: { id: existingLike.id },
  });

  await prisma.post.update({
    where: { id },
    data: {
      likeCount: {
        decrement: 1,
      },
    },
  });

  return { message: "Unliked successfully", courseId: id };
};

const getAllMyLikeIds = async (user: JwtPayload) => {
  const findUser = await prisma.user.findUnique({ where: { id: user.id } });

  if (!findUser) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  const result = await prisma.like.findMany({
    where: {
      userId: user.id,
    },
    select: {
      post: {
        select: {
          id: true,
          imageUrl: true,
        },
      },
    },
  });

  return result;
};

export const LikeService = {
  likePost,
  getAllMyLikeIds,
  unlike,
};
