import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  handle: string;
  name: string;
  email: string;
  password: string;
  createdAt?: Date;
  description: string;
  image: string;
}

const userSchema = new Schema({
  handle: { 
    type: String, 
    trim: true, 
    required: true, 
    unique: true 
  },
  name: { 
    type: String, 
    trim: true, 
    required: true 
  },
  email: { 
    type: String, 
    trim: true, 
    required: true, 
    lowercase: true, 
    unique: true 
  },
  password: { 
    type: String, 
    trim: true, 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  description: { 
    type: String, 
    trim: true, 
    default: '', 
    required: false
  },
  image: { 
    type: String, 
    trim: true,
    default: '', 
    required: false
  },
});

const User = mongoose.model<IUser>("User", userSchema);

export default User;
