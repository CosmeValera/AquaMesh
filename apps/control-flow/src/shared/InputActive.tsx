import React, { useEffect, useState } from "react";
import StatusTag from "../components/status-tag/StatusTag";

type Configuration = {
    name: string;
    status: boolean;
    loading: boolean;
}

export default function SwitchEnable(props: Configuration) {
    const [checked, setChecked] = useState<boolean>(props.status);
    const displayText = {active: 'ACTIVE', inactive: 'INACTIVE'}

    useEffect(()=> {
        setChecked(props.status)
    },[props])

    return (
        <div className="flex align-items-center">
            <div className="w-12rem">
            <p>{props.name}</p> 
            </div>
            <div className="flex justify-content-center flex-grow-1">
                {StatusTag({name:props.name, status: checked}, displayText)}
            </div>
        </div>
    );
}