import { z } from "zod";

const CreateUserValidationSchema = z.object({
  email: z.string().email("Invalid email address").min(1, "Email is required"),
  username: z.string().optional(),
  phoneNumber: z.string().optional(), // ✅
  isResticted: z.boolean().optional(),
  isNotification: z.boolean().optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .nonempty("Password is required"),
});

const UserLoginValidationSchema = z.object({
  email: z.string().email().nonempty("Email is required"),
  role: z.string().optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .nonempty("Password is required"),
});

const userUpdateSchema = z.object({
  username: z.string().optional(),
  promoCode: z.string().optional(),
  profileImage: z.string().optional(),
  profession: z.string().optional(),
  phoneNumber: z.string().optional(), 
  isResticted: z.boolean().optional(),
  isNotification: z.boolean().optional(),
});

export const UserValidation = {
  CreateUserValidationSchema,
  UserLoginValidationSchema,
  userUpdateSchema,
};
