import {useForm} from "react-hook-form";
import ErrorMessage from "../components/ErrorMessage";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import type { ProfileFormData, User } from "../types";
import { updateProfile, uploadImage } from "../api/DevTreeAPI";
import { toast } from "sonner";

export default function ProfileView() {

    const queryClient = useQueryClient();
    const data : User = queryClient.getQueryData( ['user'] )!;

    const { register, handleSubmit, formState: { errors } } = useForm<ProfileFormData>( {defaultValues: {
        handle: data.handle,
        description: data.description,
    }} );

    const updateProfileMutation = useMutation({
        mutationFn: updateProfile,
        onError: (error) => {
            toast.error(error.message);
        },
        onSuccess: (data) => {
            toast.success(data);
            queryClient.invalidateQueries( {queryKey : ['user'] });
        }
    });


    const updateImageMutation = useMutation({
        mutationFn: uploadImage,
        onError: (error) => {
            toast.error(error.message);
        },
        onSuccess: (data) => {
            console.log(data);
        }
    });

    const handleChangeImage = async ( event: React.ChangeEvent<HTMLInputElement> ) => {
        if( !event.target.files ) return;
        const file = event.target.files[0];
        updateImageMutation.mutate(file);

    }

    const handleUserProfileForm  =(formdata: ProfileFormData) => {
        updateProfileMutation.mutate(formdata);
    }

    return (
        <form 
            className="bg-white p-10 rounded-lg space-y-5"
            onSubmit={handleSubmit(handleUserProfileForm)}
        >
            <legend className="text-2xl text-slate-800 text-center">Edit Information</legend>
            <div className="grid grid-cols-1 gap-2">
                <label
                    htmlFor="handle"
                >Handle:</label>
                <input
                    type="text"
                    className="border-none bg-slate-100 rounded-lg p-2"
                    placeholder="handle or Username"
                    {
                        ...register('handle', { 
                            required: "Handle is required"
                        })
                    }
                />
                { errors.handle && <ErrorMessage>{errors.handle.message}</ErrorMessage>}
            </div>

            <div className="grid grid-cols-1 gap-2">
                <label
                    htmlFor="description"
                >Descripción:</label>
                <textarea
                    className="border-none bg-slate-100 rounded-lg p-2"
                    placeholder="Your Description"
                    {
                        ...register('description')
                    }
                />
            </div>

            <div className="grid grid-cols-1 gap-2">
                <label
                    htmlFor="handle"
                >Imagen:</label>
                <input
                    id="image"
                    type="file"
                    name="handle"
                    className="border-none bg-slate-100 rounded-lg p-2"
                    accept="image/*"
                    onChange={ handleChangeImage }
                />
            </div>

            <input
                type="submit"
                className="bg-cyan-400 p-2 text-lg w-full uppercase text-slate-600 rounded-lg font-bold cursor-pointer"
                value='Save Changes'
            />
        </form>
    )
}