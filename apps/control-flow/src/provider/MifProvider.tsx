import React, { ReactNode, useContext, useEffect, useRef, useState } from "react";
import { useFetch } from "../services/useFetch";
import { Toast } from "primereact/toast";

type MifProviderProps = {
    children: ReactNode;
    aquamesh: string;
}

type MifValueProp = {
    key: string,
    value: string,
    readOnly: boolean
}

export enum ServiceType {
    CONFIG
}

// Define the interface for the AppContext
export interface AppContextType {
    aquamesh: string;
    patchMrpfVariable: (key: string, value: string, dom?: string) => Promise<boolean>;
    getMSubStatValues: () => { loading: boolean; dataMm: MifValueProp[]; error: any };
    getSpr4Values: () => { loading: boolean; dataStm: MifValueProp[]; error: any };
}

export default function MifProvider({children, aquamesh} : MifProviderProps) {
    const { loading, data, error } = useFetch(aquamesh, "prime", ServiceType.CONFIG);

    const [dataMm, setDataMm] = useState<MifValueProp[]>([]);
    const [dataStm, setDataStm] = useState<MifValueProp[]>([]);
    
    const toast = useRef<Toast>(null);

    useEffect(() => {
        const filteredResMm = data.filter((instance: {key: string, value: string, readOnly: boolean}) => 
            instance.key === 'MMSATSTAT_PROCESSING');
        
        const filteredResStm = data.filter((instance: {key: string, value: string, readOnly: boolean}) => 
            instance.key === 'MAIN_PROCESSING' || 
            instance.key === 'MRM_PROCESSING' || 
            instance.key === 'MSBD_PROCESSING' || 
            instance.key === 'MRPF_PROCESSING');
    
        setDataMm(filteredResMm);
        setDataStm(filteredResStm);
    }, [data]);

    const getMSubStatValues = () => {
        return { loading, dataMm, error };
    }
    
    const getSpr4Values = () => {
        return { loading, dataStm, error };
    }

    const patchMrpfVariable = async (key: string, value: string) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return true;
    }

    return (
        <AppContext.Provider value={{
            aquamesh,
            patchMrpfVariable,
            getMSubStatValues,
            getSpr4Values
        }}>
            <Toast ref={toast} />
            {children}
        </AppContext.Provider>
    )
}

export const AppContext = React.createContext<AppContextType>({} as AppContextType);

export const useApp = () => {
    return useContext(AppContext);
}