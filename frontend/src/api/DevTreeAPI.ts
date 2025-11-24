import { isAxiosError } from "axios";
import api from "../config/axios";
import type { ProfileFormData, User } from "../types";

export async function getUser(){
    try {
        const {data} = await api<User>('/user');
        return data;
    }
    catch (error) {
        if (isAxiosError(error) && error.response) {
            throw new Error(error.response?.data.error);
        }
    }
}

export async function updateProfile(formData: ProfileFormData){
    try {
        const {data} = await api.patch<String>('/user', formData);
        return data;
    }
    catch (error) {
        if (isAxiosError(error) && error.response) {
            throw new Error(error.response.data.error);
        }
    }
}

export async function uploadImage(file: File){
    let formData = new FormData();
    formData.append('file', file);
    try {
        const {data} = await api.post('/user/image', formData);
        return data;
    }catch (error) {
        if (isAxiosError(error) && error.response) {
            throw new Error(error.response.data.error);
        }
    }
}