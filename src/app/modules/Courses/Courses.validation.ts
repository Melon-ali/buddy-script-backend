import { z } from "zod";

const createCourseSchema = z.object({
  name: z.string().min(1, "Course name is required"),
  thumbnailUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  price: z.number().int().min(0, "Price must be a non-negative integer"),
  category: z.string().min(1, "Category is required"),
});

const updateCourseSchema = z.object({
  name: z.string().min(1).optional(),
  thumbnailUrl: z.string().url().optional(),
  price: z.number().int().min(0).optional(),
  category: z.string().min(1).optional(),
});

export const CoursesValidation = {
  createCourseSchema,
  updateCourseSchema,
};
