import prisma from "../../../shared/prisma";
import ApiError from "../../../errors/ApiErrors";
import { IUser, IUserFilterRequest } from "./user.interface";
import * as bcrypt from "bcrypt";
import { IPaginationOptions } from "../../../interfaces/paginations";
import { paginationHelper } from "../../../helpars/paginationHelper";
import { Prisma, User } from "@prisma/client";
import { userSearchAbleFields } from "./user.costant";
import config from "../../../config";
import httpStatus from "http-status";
import { Request } from "express";
import { fileUploader } from "../../../helpars/fileUploader";
import { jwtHelpers } from "../../../helpars/jwtHelpers";

// Create a new user in the database.
const createUserIntoDb = async (payload: User) => {
  const existingUser = await prisma.user.findFirst({
    where: {
      email: payload.email,
    },
  });

  if (existingUser) {
    if (existingUser.email === payload.email) {
      throw new ApiError(
        400,
        `User with this email ${payload.email} already exists`
      );
    }
    if (existingUser.username === payload.username) {
      throw new ApiError(
        400,
        `User with this username ${payload.username} already exists`
      );
    }
  }
  const hashedPassword: string = await bcrypt.hash(
    payload.password,
    Number(config.bcrypt_salt_rounds)
  );

  const result = await prisma.user.create({
    data: { ...payload, password: hashedPassword },
    select: {
      id: true,
      username: true,
      email: true,
      image: true,
      role: true,
      status: true,
      phoneNumber: true,
      country: true,
      region: true,
      isNotification: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const accessToken = jwtHelpers.createToken(
    {
      id: result.id,
      email: result.email,
      role: result.role,
    },
    config.jwt.jwt_secret as string,
    config.jwt.expires_in as string // or number
  );

  return { token: accessToken, result };
};

// reterive all users from the database also searcing anf filetering
const getUsersFromDb = async (
  params: IUserFilterRequest,
  options: IPaginationOptions
) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = params;

  const andConditions: Prisma.UserWhereInput[] = [
    {
      role: {
        not: "SUPER_ADMIN",
      },
    },
  ];

  if (searchTerm) {
    andConditions.push({
      OR: userSearchAbleFields.map((field) => ({
        [field]: {
          contains: searchTerm,
          mode: "insensitive",
        },
      })),
    });
  }

  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          equals: (filterData as any)[key],
        },
      })),
    });
  }

  const whereConditions: Prisma.UserWhereInput = { AND: andConditions };

  const result = await prisma.user.findMany({
    where: whereConditions,
    skip,
    take: limit,
    orderBy:
      options.sortBy && options.sortOrder
        ? {
            [options.sortBy]: options.sortOrder,
          }
        : {
            createdAt: "desc",
          },
    select: {
      id: true,
      username: true,
      email: true,
      image: true,
      role: true,
      phoneNumber: true,
      isNotification: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const total = await prisma.user.count({
    where: whereConditions,
  });

  return {
    meta: {
      page,
      limit,
      total,
    },
    data: result,
  };
};

// update profile by user won profile uisng token or email and id
const updateProfile = async (req: Request) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const file = files?.file?.[0];
  const stringData = req.body.text;
  let image;
  let parseData;

  const userId = req.user && (req.user as any).id;
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      id: userId,
    },
  });
  if (!existingUser) {
    throw new ApiError(404, "User not found");
  }
  if (file) {
    image = (await fileUploader.uploadToCloudinary(file)).Location;
  }
  if (stringData) {
    parseData = JSON.parse(stringData);
  }

  const result = await prisma.user.update({
    where: {
      id: existingUser.id, // Ensure `existingUser.id` is valid and exists
    },
    data: {
      username: parseData.username || existingUser.username,
      dob: parseData.dob || existingUser.dob,
      email: parseData.email || existingUser.email,
      image: image || existingUser.image,
      phoneNumber: parseData.phoneNumber || existingUser.phoneNumber, // ✅
      updatedAt: new Date(),
    },
    select: {
      id: true,
      username: true,
      email: true,
      image: true,
      dob: true,
      phoneNumber: true,
      isNotification: true,
    },
  });

  return result;
};

// update user data into database by id fir admin
const updateUserIntoDb = async (payload: IUser, id: string) => {
  const userInfo = await prisma.user.findUniqueOrThrow({
    where: {
      id: id,
    },
  });
  if (!userInfo)
    throw new ApiError(httpStatus.NOT_FOUND, "User not found with id: " + id);

  const result = await prisma.user.update({
    where: {
      id: userInfo.id,
    },
    data: payload,
    select: {
      id: true,
      username: true,
      email: true,
      image: true,
      role: true,
      phoneNumber: true,
      isNotification: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!result)
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to update user profile"
    );

  return result;
};

const restictedUser = async (id: string, status: any) => {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new ApiError(404, "post not found");
  }
  const result = await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      status,
    },
  });
  return result;
};

const changeNotificationStatus = async (userId: string) => {
  const isExistUser = await prisma.user.findUnique({ where: { id: userId } });

  if (!isExistUser) {
    throw new ApiError(httpStatus.NOT_FOUND, "User Not Found");
  }

  const updateUser = await prisma.user.update({
    where: { id: isExistUser.id },
    data: { isNotification: isExistUser.isNotification ? false : true },
  });
  return updateUser;
};

const deleteUserFromDb = async (id: string) => {
  const userInfo = await prisma.user.findUniqueOrThrow({
    where: {
      id: id,
    },
  });
  if (!userInfo)
    throw new ApiError(httpStatus.NOT_FOUND, "User not found with id: " + id);

  const result = await prisma.user.delete({
    where: {
      id: userInfo.id,
    },
  });

  if (!result)
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to delete user"
    );

  return result;
};

const getUserById = async (id: string) => {
  const userInfo = await prisma.user.findUnique({
    where: {
      id: id,
    },
    select: {
      id: true,
      username: true,
      email: true,
      image: true,
      role: true,
      phoneNumber: true,
      isNotification: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!userInfo)
    throw new ApiError(httpStatus.NOT_FOUND, "User not found with id: " + id);

  return userInfo;
};

export const userService = {
  createUserIntoDb,
  getUsersFromDb,
  updateProfile,
  updateUserIntoDb,
  changeNotificationStatus,
  restictedUser,
  deleteUserFromDb,
  getUserById,
};
