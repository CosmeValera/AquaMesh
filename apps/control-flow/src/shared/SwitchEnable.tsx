import React, { useEffect, useRef, useState } from "react";
import { InputSwitch, InputSwitchChangeEvent } from "primereact/inputswitch";
import { Message } from 'primereact/message';
import { Tooltip } from "primereact/tooltip";

type SwitchEnableProps = {
    configuration: string;
    configurationApi?: string;
    checked: boolean;
    loading?: boolean;
    disabled?: boolean;
    error?: boolean;
    callbackPatch?: (key: string, value: string) => Promise<boolean>;
    onToggle?: (key: string, value: boolean) => void;
}

export default function SwitchEnable(props: SwitchEnableProps) {
    const [checked, setChecked] = useState(props.checked);
    const [loading, setLoading] = useState(props.loading);
    const [error, setError] = useState(props.error);

    const booleanToString = (newChecked: boolean): string => newChecked ? "ENABLED" : "DISABLED";
    
    useEffect(() => {
        setChecked(props.checked);
        setLoading(props.loading);
        setError(props.error);
    }, [props]);

    const handleSwitch = async(e: InputSwitchChangeEvent) => {
        setLoading(true);

        const response = await props.callbackPatch!(props.configurationApi!, booleanToString(!checked));
        await props.onToggle!(props.configurationApi!, response ? !checked : checked);
    
        setChecked(response ? !checked : checked);
        setLoading(!response);
        setError(!response);
    }

    return (
        <>
            <div className="flex align-items-center flex-wrap">
                <p className="w-20rem"> {props.configuration} </p>
                <div className="flex align-items-center gap-3" >
                    <InputSwitch
                        disabled={loading || props.disabled}
                        checked={!!checked}
                        onChange={handleSwitch}
                        className={loading ? "mif-loading" : ""}
                    />
                    {error &&
                        <>
                            <Tooltip target=".tooltip-msg" content="MIF API error" className="fadeinright animation-ease-out animation-duration-200"/>
                            <Message severity="error" className="tooltip-msg fadeinright animation-ease-out animation-duration-200 border-circle" />
                        </>}
                </div>
            </div>
        </>
    );
}
