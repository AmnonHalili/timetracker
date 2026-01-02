"use client";

import { useEffect } from "react";
import { Crisp } from "crisp-sdk-web";

export const CrispChat = () => {
    useEffect(() => {
        Crisp.configure("1ef8cd70-4880-4e37-80bc-791d4d629285");
    }, []);

    return null;
};
