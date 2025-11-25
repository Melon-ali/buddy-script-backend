import httpStatus from "http-status";
import ApiError from "../../../errors/ApiErrors";
import prisma from "../../../shared/prisma";
import { fileUploader } from "../../../helpars/fileUploader";
import { IDeletePostParams, IPostServiceParams, IPostUpdateParams } from "./Post.interface";

const createIntoDb = async ({ userId, reqBody, files }: IPostServiceParams) => {
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized access.");
  }

  // ✅ Parse body
  const postData = JSON.parse(reqBody.text || "{}");
  const content = postData.content;
  const visibility = postData.visibility || "PUBLIC";

  // ✅ Ensure there is either content or a file
  const file = files?.file?.[0];
  if (!content && !file) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Post must have content or an image."
    );
  }

  // ✅ Upload file if exists
  let imageUrl: string | undefined = undefined;
  if (file) {
    const uploadResult = await fileUploader.uploadToCloudinary(file);
    imageUrl = uploadResult?.Location;

    if (!imageUrl) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to upload post image."
      );
    }
  }

  // ✅ Create post in DB
  const post = await prisma.post.create({
    data: {
      authorId: userId,
      content,
      imageUrl,
      visibility,
    },
  });

  return post;
};

const getListFromDb = async () => {
  const result = await prisma.post.findMany({
    select: {
      id: true,
      content: true,
      imageUrl: true,
      visibility: true,
      createdAt: true,
      updatedAt: true,
      comments: true,
      
      // counts from your model
      commentCount: true,
      likeCount: true,

      // author basic info (optional)
      author: {
        select: {
          id: true,
          username: true,
          image: true,
        },
      },
    },
  });

  return result;
};


const getByIdFromDb = async (id: string) => {
  const result = await prisma.post.findUnique({ where: { id } });
  if (!result) {
    throw new Error("post not found");
  }
  return result;
};

const updateIntoDb = async ({ postId, reqBody, files }: IPostUpdateParams) => {
  // ✅ Check if post exists
  const existingPost = await prisma.post.findUnique({
    where: { id: postId },
  });
  if (!existingPost) {
    throw new ApiError(httpStatus.NOT_FOUND, "Post not found");
  }

  // ✅ Parse body safely
  let content = existingPost.content;
  let visibility: "PUBLIC" | "PRIVATE" = existingPost.visibility;

  if (reqBody.text) {
    try {
      const postData = JSON.parse(reqBody.text);
      content = postData.content ?? content;
      visibility = postData.visibility ?? visibility;
    } catch (err) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid JSON in text field");
    }
  } else {
    content = reqBody.content ?? content;
    visibility = reqBody.visibility ?? visibility;
  }

  // ✅ Handle file upload
  let imageUrl = existingPost.imageUrl;
  const file = files?.file?.[0];
  if (file) {
    const uploadResult = await fileUploader.uploadToCloudinary(file);
    if (!uploadResult?.Location) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to upload post image"
      );
    }
    imageUrl = uploadResult.Location;
  }

  // ✅ Update post in DB
  const updatedPost = await prisma.post.update({
    where: { id: postId },
    data: {
      content,
      visibility,
      imageUrl,
      updatedAt: new Date(),
    },
  });

  return updatedPost;
};

const deleteItemFromDb = async (id: string) => {
  // Step 1: Check if post exists
  const existingPost = await prisma.post.findUnique({
    where: { id },
  });

  if (!existingPost) {
    throw new ApiError(httpStatus.NOT_FOUND, "Post not found");
  }

  // Step 2: Delete all comments under this post (including replies)
  await prisma.comment.deleteMany({
    where: { postId: id },
  });

  // Step 3: Delete all likes under this post
  await prisma.like.deleteMany({
    where: { postId: id },
  });

  // Step 4: Delete the post itself
  const deletedPost = await prisma.post.delete({
    where: { id },
  });

  return {
    message: "Post deleted successfully",
    deletedPost,
  };
};

export const PostService = {
  createIntoDb,
  getListFromDb,
  getByIdFromDb,
  updateIntoDb,
  deleteItemFromDb,
};
