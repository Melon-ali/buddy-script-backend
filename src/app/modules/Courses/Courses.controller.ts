import httpStatus from "http-status";
import { CoursesService } from "./Courses.service";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { Request, Response } from "express";
import { ICourse, updateICourse } from "./Courses.interface";
import { fileUploader } from "../../../helpars/fileUploader";
import ApiError from "../../../errors/ApiErrors";
import pick from "../../../shared/pick";
import { courseFilterableFields } from "./courses.costant";
import { Courses } from "@prisma/client";
import { get } from "http";
import { JwtPayload } from "jsonwebtoken";

const createCourses = catchAsync(async (req: Request, res: Response) => {
  const teacherId = req.user?.id;
  const userRole = req.user?.role;

  // ✅ Authentication
  if (!teacherId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized access.");
  }

  // ✅ Only teachers can create
  if (userRole !== "TEACHER") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only teachers can create courses."
    );
  }

  // ✅ Parse body
  const courseData: Courses = JSON.parse(req.body.text || "{}");

  // ✅ Validate level (either "1"-"5" or text labels)
  const allowedLevels = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "Beginner",
    "Intermediate",
    "Pro",
  ];

  if (
    typeof courseData.level !== "string" ||
    !allowedLevels.includes(courseData.level)
  ) {
    throw new ApiError(
      400,
      "Level must be one of: 1-5, Beginner, Intermediate, Advanced, Expert."
    );
  }

  // ✅ Check uploaded file
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const file = files?.file?.[0];

  if (!file) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "No course thumbnail image uploaded."
    );
  }

  // ✅ Upload to Cloudinary (or S3)
  const uploadResult = await fileUploader.uploadToCloudinary(file);
  const thumbnailUrl = uploadResult?.Location;

  if (!thumbnailUrl) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to upload thumbnail."
    );
  }

  // ✅ Extract category IDs
  const categoryId = courseData.categoryId;
  const subCategoryId = courseData.subCategoryId;
  const subCategories2Id = courseData.subCategories2Id ?? undefined;

  // ✅ Create course in DB
  const result = await CoursesService.createIntoDb(
    courseData,
    teacherId,
    thumbnailUrl,
    categoryId,
    subCategoryId,
    subCategories2Id
  );

  // ✅ Send response
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Course created successfully.",
    data: result,
  });
});

const getCoursesInActiveList = catchAsync(
  async (req: Request, res: Response) => {
    const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
    const filters = pick(req.query, courseFilterableFields);
    const user = req.user;

    // Only teachers see their own courses; others see all
    const teacherId = user?.role === "TEACHER" ? user.id : undefined;

    const course = await CoursesService.getInActiveListFromDb(
      options,
      filters,
      teacherId
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Courses list retrieved successfully",
      meta: course.meta,
      data: course.data,
    });
  }
);

const getCoursesList = catchAsync(async (req: Request, res: Response) => {
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const filters = pick(req.query, courseFilterableFields);
  const user = req.user;

  // Only teachers see their own courses; others see all
  const teacherId = user?.role === "TEACHER" ? user.id : undefined;

  const course = await CoursesService.getListFromDb(
    user.id,
    options,
    filters,
    teacherId
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Courses list retrieved successfully",
    meta: course.meta,
    data: course.data,
  });
});

const getTopCourses = catchAsync(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 5;
  const userId = req.user.id;

  const courses = await CoursesService.getTopReviewedCourses(limit, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Top reviewed courses retrieved successfully",
    data: courses,
  });
});

const recommendCourse = async (req: Request, res: Response) => {
  const courseId = req.params.id;
  const courses = await CoursesService.recommendCourses(courseId);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Course recommended",
    data: courses,
  });
};

const getRecommendedCourses = async (_req: Request, res: Response) => {
  const courses = await CoursesService.getRecommendedCourses();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Recommended courses fetched",
    data: courses,
  });
};

const getCoursesById = catchAsync(async (req: Request, res: Response) => {
  const result = await CoursesService.getByIdFromDb(req.params.id, req.user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Courses details retrieved successfully",
    data: result,
  });
});

const getInActiveCoursesById = catchAsync(
  async (req: Request, res: Response) => {
    const result = await CoursesService.getByInActiveIdFromDb(req.params.id);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Courses details retrieved successfully",
      data: result,
    });
  }
);

const updateCourses = catchAsync(async (req: Request, res: Response) => {
  const teacherId = req.user?.id;
  const { id } = req.params;

  const couserData: updateICourse = JSON.parse(req.body.text || "{}");

  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const file = files?.file?.[0];

  let thumbnailUrl: string | undefined;

  if (file) {
    const uploadResult = await fileUploader.uploadToCloudinary(file);
    thumbnailUrl = uploadResult?.Location;
  }

  const course = await CoursesService.updateIntoDb(
    id,
    couserData,
    teacherId,
    thumbnailUrl
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Courses updated successfully",
    data: course,
  });
});

const deleteCourses = catchAsync(async (req: Request, res: Response) => {
  const result = await CoursesService.deleteItemFromDb(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Courses deleted successfully",
    data: result,
  });
});

// Controller to get total video count across all courses
const getAllDashboardCount = catchAsync(async (req: Request, res: Response) => {
  const result = await CoursesService.getAllDashboardCount();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "All dashboard count retrieved successfully",
    data: result,
  });
});

const getTotalCoursesCount = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;
  const result = await CoursesService.getTotalCoursesCount(teacherId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Total courses and price fetched successfully",
    data: result,
  });
});

const getStudentProgress = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const result = await CoursesService.getStudentVideoProgress(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Student progress summary fetched successfully",
    data: result,
  });
});

const buyCourse = catchAsync(async (req: Request, res: Response) => {
  const { courseId, paymentId } = req.body;
  const userId = req.user.id; // assuming you're using JWT middleware to attach user

  const result = await CoursesService.buyCourse(userId, courseId, paymentId);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Course purchased successfully",
    data: result,
  });
});

const getMyCourses = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;

  const courses = await CoursesService.getMyPurchasedCourses(user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Purchased courses fetched successfully",
    data: courses,
  });
});

const getTotalSellCount = catchAsync(async (req: Request, res: Response) => {
  const { id: teacherId } = req.user as JwtPayload;

  const result = await CoursesService.getTotalSellCount(teacherId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "All enrollments for your courses fetched successfully",
    data: result,
  });
});

export const CoursesController = {
  createCourses,
  getCoursesInActiveList,
  getCoursesList,
  getTopCourses,
  recommendCourse,
  getRecommendedCourses,
  getCoursesById,
  getInActiveCoursesById,
  updateCourses,
  deleteCourses,
  getAllDashboardCount,
  getTotalCoursesCount,
  getStudentProgress,
  buyCourse,
  getMyCourses,
  getTotalSellCount,
};
