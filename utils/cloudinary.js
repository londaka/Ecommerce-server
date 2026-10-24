
import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";

const uploadOnCloudinary = async (filePath) => {
  if (!filePath) return null;

  try {
    cloudinary.config({
      cloud_name: process.env.Cloudinary_Cloud_Name,
      api_key: process.env.Cloudinary_API_Key,
      api_secret: process.env.Cloudinary_API_Secret,
    });

    const response = await cloudinary.uploader.upload(filePath, {
      resource_type: "image",
      folder: "ecommerce/products",
    });

    console.log("Image uploaded:", response.secure_url);

    return {
      id: response.public_id,
      url: response.secure_url,
    };
  } catch (error) {
     console.error("Cloudinary upload failed:", {
      message: error.message,
      http_code: error.http_code,
      name: error.name,
      response: error.response,
      cause: error.cause,
      requestId: error.request_id,
    });

    throw error;
    
  } finally {
    await fs.unlink(filePath).catch(() => {});
  }
};

export { uploadOnCloudinary };
