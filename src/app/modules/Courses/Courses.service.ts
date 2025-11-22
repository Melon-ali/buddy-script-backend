import { Prisma } from "@prisma/client";
import ApiError from "../../../errors/ApiErrors";
import { paginationHelper } from "../../../helpars/paginationHelper";
import { IPaginationOptions } from "../../../interfaces/paginations";
import {
  ICourse,
  ICourseFilterRequest,
  updateICourse,
} from "./Courses.interface";
import { courseSearchAbleFields } from "./courses.costant";
import httpStatus from "http-status";
import { JwtPayload } from "jsonwebtoken";
import { notificationService } from "../Notification/Notification.service";
import { create } from "domain";
import prisma from "../../../shared/prisma";

const createIntoDb = async (
  data: ICourse,
  teacherId: string,
  thumbnailUrl: string,
  categoryId: string,
  subCategoryId: string,
  subCategories2Id?: string | "" // <-- mark as optional
) => {
  // Validation
  if (!teacherId) throw new ApiError(400, "Missing teacherId");
  if (!categoryId) throw new ApiError(400, "Missing categoryId");
  if (!subCategoryId) throw new ApiError(400, "Missing subCategoryId");

  const teacher = await prisma.user.findUnique({ where: { id: teacherId } });
  if (!teacher) throw new ApiError(404, "Teacher not found");
  if (teacher.role !== "TEACHER")
    throw new ApiError(403, "Only teachers can create courses");

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
  });
  if (!category) throw new ApiError(404, "Category not found");

  const subCategory = await prisma.subCategory.findUnique({
    where: { id: subCategoryId },
  });
  if (!subCategory) throw new ApiError(404, "SubCategory not found");

  // Create
  const course = await prisma.courses.create({
    data: {
      ...data,
      teacherId,
      thumbnailUrl,
      categoryId,
      subCategoryId,
      level: data.level,
      ...(subCategories2Id ? { subCategories2Id } : {}), // <-- only include if provided
    },
    select: {
      id: true,
      name: true,
      teacherId: true,
      thumbnailUrl: true,
      price: true,
      description: true,
      activeStatus: true,
      user: { select: { id: true, username: true } },
      level: true,
      category: { select: { id: true, name: true } },
      subCategory: { select: { id: true, name: true } },
      subCategories2: { select: { id: true, name: true } },
    },
  });

  return course;
};

const getListFromDb = async (
  userId: string,
  options: IPaginationOptions,
  params: ICourseFilterRequest & { minPrice?: number; maxPrice?: number },
  teacherId?: string
) => {
  const { limit, page, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, minPrice, maxPrice, ...filterData } = params;

  const andConditions: Prisma.CoursesWhereInput[] = [];

  // 🔍 Search by course name and category name
  if (searchTerm) {
    andConditions.push({
      OR: [
        {
          name: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
        {
          category: {
            name: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
        {
          subCategory: {
            name: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
        {
          subCategories2: {
            name: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
      ],
    });
  }

  // 💵 Filter by min and max price
  if (minPrice !== undefined || maxPrice !== undefined) {
    andConditions.push({
      price: {
        ...(minPrice !== undefined && { gte: minPrice }),
        ...(maxPrice !== undefined && { lte: maxPrice }),
      },
    });
  }

  // 🧩 Additional filters
  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          equals: (filterData as any)[key],
        },
      })),
    });
  }

  // ✅ Always filter only ACTIVE courses
  andConditions.push({
    activeStatus: "ACTIVE",
  });

  // 🧑‍🏫 Filter by teacherId
  if (teacherId) {
    andConditions.push({
      teacherId,
    });
  }

  // Final WHERE
  const whereConditions: Prisma.CoursesWhereInput = {
    AND: andConditions,
  };

  const result = await prisma.courses.findMany({
    where: whereConditions,
    include: {
      user: {
        select: {
          id: true,
          username: true,
        },
      },
      category: {
        select: {
          name: true,
        },
      },
      subCategory: {
        select: {
          name: true,
        },
      },
      subCategories2: {
        select: {
          name: true,
        },
      },
      Enrollment: {
        where: {
          studentId: userId,
        },
        select: {
          id: true, // just to check presence
        },
      },
    },
    skip,
    take: limit,
    orderBy:
      options.sortBy && options.sortOrder
        ? { [options.sortBy]: options.sortOrder }
        : { createdAt: "desc" },
  });

  // Add `isBuy` to each course object
  const coursesWithBuyStatus = result.map((course) => ({
    ...course,
    isBuy: course.Enrollment.length > 0,
  }));

  const total = await prisma.courses.count({
    where: whereConditions,
  });

  return {
    success: true,
    message: "Courses list retrieved successfully",
    meta: {
      page,
      limit,
      total,
    },
    data: coursesWithBuyStatus,
  };
};

const getInActiveListFromDb = async (
  options: IPaginationOptions,
  params: ICourseFilterRequest & { minPrice?: number; maxPrice?: number },
  teacherId?: string
) => {
  const { limit, page, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, minPrice, maxPrice, ...filterData } = params;

  const andConditions: Prisma.CoursesWhereInput[] = [];

  // 🔍 Search by course name and category name
  if (searchTerm) {
    andConditions.push({
      OR: [
        {
          name: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
        {
          category: {
            name: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
      ],
    });
  }

  // 💵 Filter by min and max price
  if (minPrice !== undefined || maxPrice !== undefined) {
    andConditions.push({
      price: {
        ...(minPrice !== undefined && { gte: minPrice }),
        ...(maxPrice !== undefined && { lte: maxPrice }),
      },
    });
  }

  // 🧩 Additional filters
  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          equals: (filterData as any)[key],
        },
      })),
    });
  }

  // ✅ Always filter only ACTIVE courses
  andConditions.push({
    activeStatus: "INACTIVE",
  });

  // 🧑‍🏫 Filter by teacherId
  if (teacherId) {
    andConditions.push({
      teacherId,
    });
  }

  // Final WHERE
  const whereConditions: Prisma.CoursesWhereInput = {
    AND: andConditions,
  };

  const result = await prisma.courses.findMany({
    where: whereConditions,
    include: {
      user: {
        select: {
          id: true,
          username: true,
        },
      },
      category: {
        include: {
          subcategories: {
            include: {
              subcategories2: true,
            },
          },
        },
      },
    },
    skip,
    take: limit,
    orderBy:
      options.sortBy && options.sortOrder
        ? { [options.sortBy]: options.sortOrder }
        : { createdAt: "desc" },
  });

  const total = await prisma.courses.count({
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

const getTopReviewedCourses = async (limit: number = 5, userId: string) => {
  // Step 1: Group reviews to calculate average rating and count per course
  const topCourseRatings = await prisma.review.groupBy({
    by: ["courseId"],
    _avg: {
      rating: true,
    },
    _count: {
      rating: true,
    },
    orderBy: {
      _avg: {
        rating: "desc",
      },
    },
    take: limit,
  });

  // Step 2: Extract top course IDs
  const courseIds = topCourseRatings.map((item) => item.courseId);

  if (courseIds.length === 0) return [];

  // Step 3: Fetch active courses with those IDs and include teacher info and reviews
  const courses = await prisma.courses.findMany({
    where: {
      id: {
        in: courseIds,
      },
      activeStatus: "ACTIVE",
    },

    include: {
      Enrollment: {
        where: {
          studentId: userId,
        },
        select: {
          id: true, // just to check presence
        },
      },
      review: true,
      user: {
        select: {
          id: true,
          username: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      subCategory: {
        select: {
          id: true,
          name: true,
        },
      },
      subCategories2: {
        select: {
          id: true,
          name: true,
        },
      },
      videos: {
        select: {
          id: true,
          videoUrl: true,
          videoDuration: true,
          title: true,
          subTitle: true,
          description: true,
          serialNo: true,
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
    },
  });

  // Step 4: Map courseId to avg rating for quick lookup
  const ratingMap = new Map(
    topCourseRatings.map((item) => [item.courseId, item._avg.rating])
  );

  // Step 5: Add avgRating to each course and sort
  const sortedCourses = courses
    .map((course) => ({
      ...course,
      isBuy: course.Enrollment.length > 0,
      avgRating: ratingMap.get(course.id) ?? 0,
    }))
    .sort((a, b) => b.avgRating - a.avgRating); // Maintain correct order

  return sortedCourses;
};

const getByIdFromDb = async (id: string, userId: string) => {
  const result = await prisma.courses.findFirst({
    where: {
      id,
      activeStatus: "ACTIVE",
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      subCategory: {
        select: {
          id: true,
          name: true,
        },
      },
      subCategories2: { select: { name: true } },
      Enrollment: {
        where: { studentId: userId },
      },
      videos: {
        select: {
          id: true,
          thumbnailUrl: true,
          videoUrl: true,
          videoDuration: true,
          title: true,
          subTitle: true,
          description: true,
          serialNo: true,
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
      review: {
        select: {
          id: true,
          rating: true,
        },
      },
    },
  });

  if (!result) {
    throw new Error("Course not found");
  }

  // Calculate average rating
  const reviewRatings = result.review.map((r) => r.rating);
  const reviewCount = reviewRatings.length;
  const averageRating = reviewCount
    ? (reviewRatings.reduce((sum, r) => sum + r, 0) / reviewCount).toFixed(1)
    : null;

  return {
    ...result,
    isBuy: result.Enrollment.length > 0,
    reviewCount,
    averageRating,
  };
};

const getByInActiveIdFromDb = async (id: string) => {
  const result = await prisma.courses.findUnique({
    where: { id, activeStatus: "INACTIVE" },
    include: {
      user: {
        select: {
          id: true,
          username: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      subCategory: {
        select: {
          id: true,
          name: true,
        },
      },
      subCategories2: {
        select: {
          id: true,
          name: true,
        },
      },
      videos: {
        select: {
          id: true,
          thumbnailUrl: true,
          videoUrl: true,
          videoDuration: true,
          title: true,
          subTitle: true,
          description: true,
          serialNo: true,
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
      review: {
        select: {
          id: true,
          rating: true,
        },
      },
    },
  });

  if (!result) {
    throw new Error("Course not found");
  }

  // Calculate average rating
  const reviewRatings = result.review.map((r) => r.rating);
  const reviewCount = reviewRatings.length;
  const averageRating = reviewCount
    ? (reviewRatings.reduce((sum, r) => sum + r, 0) / reviewCount).toFixed(1)
    : null;

  return {
    ...result,
    reviewCount,
    averageRating,
  };
};

const updateIntoDb = async (
  id: string,
  data: updateICourse,
  teacherId: string,
  thumbnailUrl?: string
) => {
  const isExitsCourse = await prisma.courses.findFirst({
    where: { id, teacherId },
  });
  if (!isExitsCourse) {
    throw new ApiError(404, "Course not found");
  }

  const updateData: any = { ...data };

  if (thumbnailUrl !== undefined) {
    updateData.thumbnailUrl = thumbnailUrl;
  }

  // Ensure categoryId (or any optional field) is only set if not undefined
  if (data.categoryId !== undefined) {
    updateData.categoryId = data.categoryId;
  }

  const updatedCourse = await prisma.courses.update({
    where: { id },
    data: updateData,
    include: {
      user: {
        select: {
          id: true,
          username: true,
        },
      }
    },
  });

  return updatedCourse;
};

const deleteItemFromDb = async (id: string) => {
    const course = await prisma.courses.findUnique({
      where: { id },
    });

    if (!course) {
      throw new ApiError(httpStatus.NOT_FOUND, "Course not found");
    }

    const deletedItem = await prisma.courses.delete({
      where: { id },
    });

    return deletedItem;
  
};

const getAllDashboardCount = async () => {
  const allCourses = await prisma.courses.count();
  const allCoursesDetails = await prisma.courses.findMany({
    include: {
      user: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  }); // changed from findMany to count
  const allVideos = await prisma.videos.count();
  const allTeachers = await prisma.user.count({
    where: { role: "TEACHER" },
  });
  const allStudents = await prisma.user.count({
    where: { role: "STUDENT" },
  });
  const allActiveUsers = await prisma.user.count({
    where: { status: "ACTIVE" },
  });

  return {
    allCourses,
    allCoursesDetails,
    allVideos,
    allTeachers,
    allStudents,
    allActiveUsers,
  };
};

const getTotalCoursesCount = async (teacherId: string) => {
  // Count total number of courses by this teacher
  const totalCourses = await prisma.courses.count({
    where: { teacherId },
  });

  const allCourses = await prisma.courses.findMany({
    where: { teacherId },
    select: {
      id: true,
      name: true,
      price: true,
      thumbnailUrl: true,
      description: true,
      categoryId: true,
      videoCount: true,
      reviewCount: true,
      teacherId: true,
      user: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });

  // Sum total price of courses by this teacher
  const priceSum = await prisma.courses.aggregate({
    where: { teacherId },
    _sum: {
      price: true,
    },
  });

  return {
    totalCourses,
    allCourses,
    totalCoursePrice: priceSum._sum.price || 0,
  };
};

const getStudentVideoProgress = async (userId: string) => {
  try {
    // Step 1: Get enrolled course info
    const libraries = await prisma.enrollment.findMany({
      where: { studentId: userId },
      select: {
        courseId: true,
        course: {
          select: {
            id: true,
            name: true,
            thumbnailUrl: true,
            teacherId: true,
            level: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
            subCategory: {
              select: {
                id: true,
                name: true,
              },
            },
            subCategories2: {
              select: {
                id: true,
                name: true,
              },
            },
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    });

    const enrolledCourseIds = libraries.map((lib) => lib.courseId);
    if (enrolledCourseIds.length === 0) {
      return [];
    }

    // Step 2: Count total videos per course
    const groupedCounts = await prisma.videos.groupBy({
      by: ["courseId"],
      where: { courseId: { in: enrolledCourseIds } },
      _count: {
        id: true,
      },
    });

    const videoCountMap = new Map(
      groupedCounts.map((item) => [item.courseId, item._count.id])
    );

    // Step 3: Fetch watched videos
    const watchedHistories = await prisma.watchHistory.findMany({
      where: { userId },
      select: {
        video: {
          select: {
            courseId: true,
          },
        },
      },
    });

    // Step 4: Count watched per course
    const watchCountMap = new Map<string, number>();
    for (const history of watchedHistories) {
      const courseId = history.video?.courseId;
      if (courseId && enrolledCourseIds.includes(courseId)) {
        watchCountMap.set(courseId, (watchCountMap.get(courseId) || 0) + 1);
      }
    }

    // Step 5: Merge final result
    const result = libraries.map((lib) => {
      const course = lib.course;
      const username = lib.course.user.username;

      return {
        courseId: course?.id,
        courseName: course?.name,
        courseThumbnailUrl: course?.thumbnailUrl,
        courseTeacherName: username,
        courseLevel: course?.level,
        category: course?.category?.name,
        subCategory: course?.subCategory?.name,
        subCategories2: course?.subCategories2?.name,
        videoCounts: videoCountMap.get(course?.id) || 0,
        watchVideo: watchCountMap.get(course?.id) || 0,
      };
    });

    return result;
  } catch (error) {
    console.error("Error in getStudentVideoProgress:", error);
    throw new ApiError(500, "Failed to fetch student progress");
  }
};


// const buyCourse = async (userId: string, courseId: string) => {
//   // 🔒 Check if user exists and has STUDENT role
//   const user = await prisma.user.findUnique({ where: { id: userId } });
//   if (!user || user.role !== "STUDENT") {
//     throw new ApiError(httpStatus.FORBIDDEN, "Only students can buy courses");
//   }

//   // 🔍 Check if the course exists
//   const course = await prisma.courses.findUnique({ where: { id: courseId } });
//   if (!course) {
//     throw new ApiError(httpStatus.NOT_FOUND, "Course not found");
//   }

//   // ❌ Prevent duplicate purchase
//   const existingEnrollment = await prisma.enrollment.findUnique({
//     where: {
//       studentId_courseId: {
//         studentId: userId,
//         courseId: courseId,
//       },
//     },
//   });

//   if (existingEnrollment) {
//     throw new ApiError(httpStatus.CONFLICT, "Course already purchased");
//   }

//   // ✅ Enroll the student
//   const enrollment = await prisma.enrollment.create({
//     data: {
//       studentId: userId,
//       courseId: courseId,
//     },
//   });

//   // ✅ Update the course to mark it as purchased (isBuy = true)
//   await prisma.courses.update({
//     where: { id: courseId },
//     data: { isBuy: true },
//   });

//   return enrollment;
// };

const buyCourse = async (
  userId: string,
  courseId: string,
  paymentId: string
) => {
  // 🔒 Check if user exists and has STUDENT role
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "STUDENT") {
    throw new ApiError(httpStatus.FORBIDDEN, "Only students can buy courses");
  }

  // 🔍 Check if the course exists
  const course = await prisma.courses.findUnique({
    where: { id: courseId },
    include: {
      user: true, // Include teacher details
    },
  });

  if (!course) {
    throw new ApiError(httpStatus.NOT_FOUND, "Course not found");
  }

  const teacher = course.user;
  if (!teacher) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "Teacher not found for this course"
    );
  }

  // ✅ Enroll the student
  const enrollment = await prisma.enrollment.create({
    data: {
      studentId: userId,
      courseId: courseId,
      paymentId: paymentId,
    },
  });

  return enrollment;
};

const getMyPurchasedCourses = async (user: JwtPayload) => {
  // Check if user exists and is a STUDENT
  const findUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!findUser || findUser.role !== "STUDENT") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only students can view purchased courses"
    );
  }

  // Find all enrollments for the student
  const enrollments = await prisma.enrollment.findMany({
    where: {
      studentId: user.id,
    },
    include: {
      course: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              role: true,
              email: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          subCategory: {
            select: {
              id: true,
              name: true,
            },
          },
          subCategories2: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  // Format response
  const purchasedCourses = enrollments.map((enroll) => ({
    id: enroll.course.id,
    title: enroll.course.name,
    description: enroll.course.description,
    thumbnailUrl: enroll.course.thumbnailUrl,
    level: enroll.course.level,
    category: enroll.course.category?.name,
    subCategory: enroll.course.subCategory?.name,
    subCategories2: enroll.course.subCategories2?.name,
    createdAt: enroll.createdAt,
    updatedAt: enroll.updatedAt,
    teacher: {
      id: enroll.course.user.id,
      username: enroll.course.user.username,
      role: enroll.course.user.role,
      email: enroll.course.user.email,
    },
  }));

  return purchasedCourses;
};

const getTotalSellCount = async (teacherId: string) => {
  // Get all enrollments for the teacher's courses
  const enrollments = await prisma.enrollment.findMany({
    where: {
      course: {
        teacherId,
      },
    },
    include: {
      course: {
        select: {
          id: true,
          name: true,
          price: true,
          thumbnailUrl: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          subCategory: {
            select: {
              id: true,
              name: true,
            },
          },
          subCategories2: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      student: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
    },
  });

  const totalEnrollmentCount = enrollments.length;

  // ✅ Group enrollments by course ID
  const sellCountsByCourse: Record<
    string,
    {
      courseId: string;
      name: string;
      price: number;
      thumbnailUrl: string;
      sellCount: number;
      totalRevenue: number;
    }
  > = {};

  for (const enrollment of enrollments) {
    const course = enrollment.course;
    if (!sellCountsByCourse[course.id]) {
      sellCountsByCourse[course.id] = {
        courseId: course.id,
        name: course.name,
        price: course.price,
        thumbnailUrl: course.thumbnailUrl,
        sellCount: 1,
        totalRevenue: course.price,
      };
    } else {
      sellCountsByCourse[course.id].sellCount += 1;
      sellCountsByCourse[course.id].totalRevenue += course.price;
    }
  }

  const sellSummary = Object.values(sellCountsByCourse);

  // ✅ Calculate total revenue across all courses
  const totalRevenue = sellSummary.reduce(
    (acc, course) => acc + course.totalRevenue,
    0
  );

  return {
    totalEnrollmentCount,
    totalRevenue,
    sellSummary,
    // enrollments, // optional: return for detailed logs
  };
};

const recommendCourses = async (courseId: string) => {
  const courses = await prisma.courses.update({
    where: { id: courseId },
    data: { recommended: true },
  });

  return courses;
};

const getRecommendedCourses = async () => {
  const courses = await prisma.courses.findMany({
    where: { recommended: true, activeStatus: "ACTIVE" },
    include: {
      user: {
        select: {
          username: true,
          email: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      subCategory: {
        select: {
          id: true,
          name: true,
        },
      },
      subCategories2: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return courses;
};

export const CoursesService = {
  createIntoDb,
  getInActiveListFromDb,
  getListFromDb,
  getTopReviewedCourses,
  getByIdFromDb,
  getByInActiveIdFromDb,
  updateIntoDb,
  deleteItemFromDb,
  getAllDashboardCount,
  getTotalCoursesCount,
  getStudentVideoProgress,
  buyCourse,
  getMyPurchasedCourses,
  getTotalSellCount,
  recommendCourses,
  getRecommendedCourses,
};
