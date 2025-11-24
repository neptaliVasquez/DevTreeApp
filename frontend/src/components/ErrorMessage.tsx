type ErrorMessageProps = {
    children: React.ReactNode;
};

export default function ErrorMessage({children}: ErrorMessageProps) {
    return(
        // error message styling with an animation
       <p className="text-red-500 font-semibold">{children}</p>
    )
}

