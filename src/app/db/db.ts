import { UserRole } from "@prisma/client";
import prisma from "../../shared/prisma";
import * as bcrypt from "bcrypt";
import config from "../../config";
export const initiateSuperAdmin = async () => {
  const hashedPassword = await bcrypt.hash(
    "123456789",
    Number(config.bcrypt_salt_rounds)
  );
  const payload: any = {
    username: "Admin",
    email: "admin@gmail.com",
    password: hashedPassword,
    role: UserRole.SUPER_ADMIN,
  };

  const isExistUser = await prisma.user.findUnique({
    where: {
      username: payload.username,
      email: payload.email,
    },
  });

  if (isExistUser) {
    console.log("Super Admin already exists!");
    return;
  }

  const createSuperAdmin = await prisma.user.create({
    data: payload,
  });

  if (createSuperAdmin) {
    console.log("Super Admin created succesfully!");
  }
};
