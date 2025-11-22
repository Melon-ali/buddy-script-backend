import { v2 as cloudinary } from "cloudinary";
import { config } from "dotenv";
import type { Express } from "express";

config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadToCloudinary = async (
  file: Express.Multer.File,
  folder: string
) => {
  try {
    // Convert file buffer to base64
    const fileStr = `data:${file.mimetype};base64,${file.buffer.toString(
      "base64"
    )}`;

    // Upload to Cloudinary
    const UploadResult = await cloudinary.uploader.upload(fileStr, {
      folder: `memories/${folder}`,
      resource_type: "auto",
    });

    return UploadResult;
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    return null;
  }
};
