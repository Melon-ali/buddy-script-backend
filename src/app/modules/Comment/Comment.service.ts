import prisma from "../../../shared/prisma";

const createIntoDb = async (data: any) => {
  const result = await prisma.comment.create({ data });
  return result;
};

const getListFromDb = async () => {
  const result = await prisma.comment.findMany();
  return result;
};

const getByIdFromDb = async (id: string) => {
  const result = await prisma.comment.findUnique({ where: { id } });
  if (!result) {
    throw new Error("comment not found");
  }
  return result;
};

const updateIntoDb = async (id: string, data: any) => {
  const result = await prisma.comment.update({
    where: { id },
    data,
  });
  return result;
};

const deleteItemFromDb = async (id: string) => {
  const deletedItem = await prisma.comment.delete({
    where: { id },
  });

  // Add any additional logic if necessary, e.g., cascading deletes
  return deletedItem;
};
export const CommentService = {
  createIntoDb,
  getListFromDb,
  getByIdFromDb,
  updateIntoDb,
  deleteItemFromDb,
};
