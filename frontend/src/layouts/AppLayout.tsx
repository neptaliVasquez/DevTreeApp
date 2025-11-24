import { useQuery } from "@tanstack/react-query";
import { getUser } from "../api/DevTreeAPI";
import { Navigate } from "react-router-dom";
import DevTree from "../components/DevTree";

export default function AppLayout() {

    const { data, error, isLoading, isError } = useQuery({
        queryKey: ['user'],
        queryFn: getUser,
        refetchOnWindowFocus: false,
    });

    if (isLoading) {
        return <div>Loading...</div>;
    }
    if (isError) {
        return <Navigate to="/auth/login" replace />;
    }

    if(data) return (
        <DevTree data={data} />
    )
}