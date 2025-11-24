import { Request, Response } from "express";
import slug from "slug";
import { hashPassword, comparePassword } from "../utils/auth";
import User from "../models/User";
import { generateJWT } from "../utils/jwt";
import formidable from "formidable"; 
import cloudinary from "../config/cloudinary";

export const createAccount = async (req: Request, res: Response) => {
  const { email, password, handle } = req.body;
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).send({ message: "Email already in use" });
  }

  const slugifiedHandle = slug(handle);

  const existingHandle = await User.findOne({ handle: slugifiedHandle });
  if (existingHandle) {
    return res.status(400).send({ message: "Handle already in use" });
  }

  const hashedPassword = await hashPassword(password);

  const user = new User({
    ...req.body,
    password: hashedPassword,
    handle: slugifiedHandle,
  });
  await user.save();
  res.status(201).send({ message: "User registered successfully" });
};

export const login = async (req: Request, res: Response) => {
  // Find user by email
  const existingUser = await User.findOne({ email: req.body.email });
  if (!existingUser) {
    return res.status(400).send({ message: "Invalid email or password" });
  }
  // Compare passwords
  const isPasswordValid = await comparePassword(
    req.body.password,
    existingUser.password
  );
  if (!isPasswordValid) {
    return res.status(400).send({ message: "Invalid email or password" });
  }

  const token = generateJWT({
    id: existingUser._id,
    email: existingUser.email,
  });
  res.status(200).send({ token, message: "Login successful" });
};

export const getUser = async (req: Request, res: Response) => {
  res.status(200).send(req.user);
};

export const updateProfile = async (req: Request, res: Response) => {
  const { description } = req.body;

  // Check if handle is being used by another user
  const handle = slug(req.body.handle, "");
  const existingHandle = await User.findOne({ handle });
  if (
    existingHandle &&
    existingHandle._id.toString() !== req.user._id.toString()
  ) {
    const error = new Error("Handle already in use");
    return res.status(400).json({ error: error.message });
  }
  // Update user profile
  req.user.description = description;
  req.user.handle = handle;
  // Save updated user
  await req.user.save();

  // Send response
  res.status(200).send("Profile updated successfully");
};

export const uploadImage = async (req: Request, res: Response) => {
  try {
    const form = formidable({ multiples: false });
    form.parse(req, async (err, fields, files) => {
      if (err) {
        return res.status(500).json({ error: "Error parsing form data" });
      }
      
      console.log(files);
      
      // Get the uploaded file
      const file = files.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      // Handle both array and single file formats
      const uploadedFile = Array.isArray(file) ? file[0] : file;
      const filePath = uploadedFile.filepath;
      
      cloudinary.uploader.upload(filePath, {}, async function(error, result) {
        if (error) {
          console.log(error);
          return res.status(500).json({ error: "Error uploading image" });
        }
        if(result){
          req.user.image = result.secure_url;
          await req.user.save();
          res.json({ imageUrl: result.secure_url });
        }
      });
    });
  } catch (e) {
    const error = e as Error;
    return res.status(500).json({ error: error.message });
  }
};
