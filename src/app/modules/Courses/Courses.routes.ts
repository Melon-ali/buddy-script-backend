import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { CoursesController } from "./Courses.controller";
import { CoursesValidation } from "./Courses.validation";
import { fileUploader } from "../../../helpars/fileUploader";
import { UserRole } from "@prisma/client";

const router = express.Router();

router.post(
  "/create-course",
  auth(),
  // validateRequest(CoursesValidation.createCourseSchema),
  fileUploader.uploadCourses,
  CoursesController.createCourses // 🔒 only teachers can create courses
);

router.get("/inActive", auth(), CoursesController.getCoursesInActiveList);

router.get("/", auth(), CoursesController.getCoursesList);

router.get(
  "/allDashboardCount",
  auth(),
  CoursesController.getAllDashboardCount
);

router.get("/topCourses", auth(), CoursesController.getTopCourses);

router.get("/studentProgress", auth(), CoursesController.getStudentProgress);

router.post("/buy", auth(UserRole.STUDENT), CoursesController.buyCourse);

router.get("/my-courses", auth(), CoursesController.getMyCourses);

router.get(
  "/sell",
  auth(UserRole.TEACHER),
  CoursesController.getTotalSellCount
);

router.get("/recommend", auth(), CoursesController.getRecommendedCourses);

router.post("/recommend/:id", auth(UserRole.TEACHER, UserRole.SUPER_ADMIN), CoursesController.recommendCourse);

router.get("/start/:teacherId", auth(), CoursesController.getTotalCoursesCount);

router.get("/:id", auth(), CoursesController.getCoursesById);

router.get("/inactive/:id", auth(), CoursesController.getInActiveCoursesById);

router.put(
  "/:id",
  auth(),
  fileUploader.uploadCourses,
  validateRequest(CoursesValidation.updateCourseSchema),
  CoursesController.updateCourses
);

router.delete("/:id", auth(), CoursesController.deleteCourses);

export const CoursesRoutes = router;
