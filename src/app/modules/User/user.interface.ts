import { UserRole, UserStatus } from "@prisma/client";

export interface IUser {
  id?: string;
  email: string;
  username: string;
  phoneNumber?: string; // ✅ New
  location?: string;    // ✅ New
  password: string;
  role: UserRole;
  profession: string;
  promoCode: string;
  status: UserStatus;
  isResticted: boolean;
  isNotification: boolean;
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}


export type IUserFilterRequest = {
  name?: string | undefined;
  email?: string | undefined;
  contactNumber?: string | undefined;
  searchTerm?: string | undefined;
}