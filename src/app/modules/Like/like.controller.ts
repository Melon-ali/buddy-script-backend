import { JwtPayload } from "jsonwebtoken";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { LikeService } from "./like.services";

const toggleLike = catchAsync(async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  const result = await LikeService.likePost(id, user);
  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "Like Created Successfully",
    data: result,
  });
});

const unlike = catchAsync(async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  const result = await LikeService.unlike(id, user);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: result.message,
    data: { courseId: result.courseId },
  });
});


const getAllMyLikeIds = catchAsync(async (req, res) => {
  const user = req.user;
  console.log(user)
  const result = await LikeService.getAllMyLikeIds(user as JwtPayload);
  console.log(result)
  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "successfully",
    data: result,
  });
});

export const likeController = {
  toggleLike,
  getAllMyLikeIds,
  unlike
};
