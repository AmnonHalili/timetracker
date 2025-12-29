"use client";

import { useSession, signOut, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export function useAuth() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const user = session?.user;
    const isAuthenticated = status === "authenticated";
    const isLoading = status === "loading";

    const login = async () => {
        // Redirects to standard login page
        router.push("/login");
    };

    const logout = async () => {
        await signOut({ callbackUrl: "/login" });
    };

    return {
        user,
        isAuthenticated,
        isLoading,
        login,
        logout,
    };
}
