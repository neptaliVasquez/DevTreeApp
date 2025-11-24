export type User ={
    name: string;
    email: string;
    handle: string;
    _id: string;
    description: string;
}
export type RegisterFormData = Pick<User, 'name' | 'email' | 'handle' > & {
    password: string;
    password_confirmation: string;
}

export type LoginForm = Pick<User, 'email'> & {
    password: string;
}

export type ProfileFormData = Pick<User, 'handle' | 'description'>