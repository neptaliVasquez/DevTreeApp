import { Link } from "react-router-dom";
import {useForm} from "react-hook-form"
import { isAxiosError } from "axios";
import api from "../config/axios";
import {toast} from "sonner";
import type { RegisterFormData } from "../types";
import ErrorMessage from "../components/ErrorMessage";

export default function RegisterView() {

  const initialValues:RegisterFormData ={
    name: "",
    email: "",
    handle: "",
    password: "",
    password_confirmation: "",
  }

  const { register, watch, reset,handleSubmit, formState: { errors } } = useForm({
    defaultValues: initialValues,
  });

 const handleRegister = async(formData:RegisterFormData) => {
    try {
      const response = await api.post(`/auth/register`, formData);
    toast.success(response.data.message || "Registration successful!");
    reset();
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      const axiosError = error;
      const message = axiosError.response?.data?.message || "Registration failed. Please try again.";
      toast.error(message);
    }
  }
 }


  return (
    <>
      <h1 className="text-4xl text-white font-bold">Create your account</h1>
      <form
        onSubmit={handleSubmit(handleRegister)}
        className="bg-white px-5 py-20 rounded-lg space-y-10 mt-10"
      >
        <div className="grid grid-cols-1 space-y-3">
          <label htmlFor="name" className="text-2xl text-slate-500">
            Name
          </label>
          <input
            id="name"
            type="text"
            placeholder="Your Name"
            className="bg-slate-100 border-none p-3 rounded-lg placeholder-slate-400"
            {
                ...register("name", {
                    required: "Name is required",
                })
            }
          />
          {errors.name && <ErrorMessage>{errors.name.message}</ErrorMessage>}
        </div>
        <div className="grid grid-cols-1 space-y-3">
          <label htmlFor="email" className="text-2xl text-slate-500">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            placeholder="Registration Email"
            className="bg-slate-100 border-none p-3 rounded-lg placeholder-slate-400"
            {
                ...register("email", {
                    required: "Email is required",
                    pattern: {
                        value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                        message: "Invalid email address",
                    },
                })      
            }
          />
          {errors.email && <ErrorMessage>{errors.email.message}</ErrorMessage>}
        </div>
        <div className="grid grid-cols-1 space-y-3">
          <label htmlFor="handle" className="text-2xl text-slate-500">
            Handle
          </label>
          <input
            id="handle"
            type="text"
            placeholder="Username: no spaces"
            className="bg-slate-100 border-none p-3 rounded-lg placeholder-slate-400"
            {
                ...register("handle", {
                    required: "Handle is required",
                })
            }
          />
          {errors.handle && <ErrorMessage>{errors.handle.message}</ErrorMessage>}
        </div>
        <div className="grid grid-cols-1 space-y-3">
          <label htmlFor="password" className="text-2xl text-slate-500">
            Password
          </label>
          <input
            id="password"
            type="password"
            placeholder="Registration Password"
            className="bg-slate-100 border-none p-3 rounded-lg placeholder-slate-400"
            {
                ...register("password", {
                    required: "Password is required",
                    minLength: {
                        value: 8,
                        message: "Password must be at least 8 characters long",
                    },
                })
            }
          />
          {errors.password && <ErrorMessage>{errors.password.message}</ErrorMessage>}
        </div>

        <div className="grid grid-cols-1 space-y-3">
          <label
            htmlFor="password_confirmation"
            className="text-2xl text-slate-500"
          >
            Repeat Password
          </label>
          <input
            id="password_confirmation"
            type="password"
            placeholder="Repeat Password"
            className="bg-slate-100 border-none p-3 rounded-lg placeholder-slate-400"
            {
                ...register("password_confirmation", {
                    required: "Please confirm your password",
                    validate: (value) =>
                        value === watch("password") || "Passwords do not match",
                })
            }
          />
          {errors.password_confirmation && (<ErrorMessage>{errors.password_confirmation.message}</ErrorMessage>)}
        </div>

        <input
          type="submit"
          className="bg-cyan-400 p-3 text-lg w-full uppercase text-slate-600 rounded-lg font-bold cursor-pointer"
          value="Create Account"
        />
      </form>
      <nav className="mt-10">
        <Link to="/auth/login" className="text-center text-white text-lg block">
          You already have an account? Login here.
        </Link>
      </nav>
    </>
  );
}
