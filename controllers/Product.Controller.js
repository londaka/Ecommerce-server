import TryCatch from "../utils/TryCatch.js";
import { Product } from "../models/Product.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { v2 as cloudinary } from "cloudinary"; // Added Cloudinary import here
import fs from "fs/promises";

export const createProduct = TryCatch(async (req, res) => {
  // Only admins can create products
  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "You are not admin",
    });
  }

  const { title, description, category, price, stock } = req.body;

  const files = req.files;

  // Validate required fields
  if (
    !title ||
    !description ||
    !category ||
    price === undefined ||
    stock === undefined
  ) {
    return res.status(400).json({
      message: "Please provide all product details",
    });
  }

  // Validate uploaded images
  if (!files || files.length === 0) {
    return res.status(400).json({
      message: "Please upload at least one product image",
    });
  }

  const uploadedImages = [];

  try {
    // Upload each image to Cloudinary
    for (const file of files) {
      const image = await uploadOnCloudinary(file.path);

      if (!image) {
        throw new Error("Failed to upload product image");
      }

      uploadedImages.push(image);
    }

    // Create product in MongoDB
    const product = await Product.create({
      title,
      description,
      category,
      price: Number(price),
      stock: Number(stock),
      images: uploadedImages,
    });

    return res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    // Clean up any remaining temporary files
    await Promise.all(
      files.map((file) =>
        fs.unlink(file.path).catch(() => {})
      )
    );

    // Remove already-uploaded images if a later upload fails
    await Promise.all(
      uploadedImages.map((image) =>
        import("cloudinary").then(({ v2 }) =>
          v2.uploader.destroy(image.id).catch(() => {})
        )
      )
    );

    throw error;
  }
});

export const getAllProduct = TryCatch(async(req, res)=>{
  const { search, category, page, sortByPrice } = req.query
  const requestedPage = Number(page)
  const currentPage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  
  const filter = {}

  if(search){
    filter.title={
      $regex: search,$options: "i"
    }
  }

  if(category){
    filter.category = category
  }
  let sortOption = {createdAt: -1}
  if(sortByPrice==="lowToHigh"){
     sortOption = {price: 1}
  }else if(sortByPrice==="highToLow"){
    sortOption = {price: -1}
  }
  const limit = 8
  const skip = (currentPage-1)*limit
  const countProduct = await Product.countDocuments(filter)
  const totalPages = Math.max(1, Math.ceil(countProduct / limit))

  const products = await Product.find(filter)
  .sort(sortOption)
  .limit(limit)
  .skip(skip)

  const categories = await Product.distinct("category")

  const newProduct = await Product.find().sort("-createdAt").limit(4)

  res.json({products, categories, totalPages, newProduct})
})

export const getSingleProduct = TryCatch(async(req, res)=>{
  const product = await Product.findById(req.params.id)

  if(!product){
    return res.status(404).json({message: "Product not found"})
  }

  const relatedProduct = await Product.find({
    category: product.category,
    _id: {$ne: product._id}
  }).limit(4)

  res.json({product, relatedProduct})
})


export const updateProduct = TryCatch(async(req, res)=>{
  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "You are not admin",
    });
  }
  const { title, description, category, price, stock } = req.body;

  const updateFields = {}

  if(title) updateFields.title = title
  if(description) updateFields.description = description
  if(category) updateFields.category = category
  if(price) updateFields.price = price
  if(stock) updateFields.stock = stock

  const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateFields, {new: true, runValidators: true})

  if(!updatedProduct) return res.status(404).json({
    message: "Product not found"
  })

  res.json({
    message: "Product Updated",
    updatedProduct
  })
})

export const updateProductImage = TryCatch(async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "You are not admin",
    });
  }

  const { id } = req.params;
  const files = req.files;

  if (!files || files.length === 0) {
    return res.status(400).json({
      message: "Please upload at least one product image",
    });
  }

  const product = await Product.findById(id);

  if (!product) {
    return res.status(404).json({
      message: "Product not found",
    });
  }

  const uploadedImages = [];

  try {
    // Upload each new image to Cloudinary
    for (const file of files) {
      const image = await uploadOnCloudinary(file.path);

      if (!image) {
        throw new Error("Failed to upload product image");
      }

      uploadedImages.push(image);
    }

    // Keep track of old images before overwriting them
    const oldImages = product.images || [];

    // Assign new images
    product.images = uploadedImages;
    await product.save();

    // Successfully saved! Now safely delete the old images from Cloudinary using `cloudinary`
    for (const img of oldImages) {
      if (img.id) {
        await cloudinary.uploader.destroy(img.id).catch(() => {});
      }
    }

    return res.status(200).json({
      message: "Image Updated",
      product,
    });
  } catch (error) {
    // Clean up local temp files if any failed
    if (files) {
      await Promise.all(
        files.map((file) =>
          fs.unlink(file.path).catch(() => {})
        )
      );
    }

    // Remove newly uploaded images if something failed mid-way
    await Promise.all(
      uploadedImages.map((image) =>
        cloudinary.uploader.destroy(image.id).catch(() => {})
      )
    );

    throw error;
  }
});