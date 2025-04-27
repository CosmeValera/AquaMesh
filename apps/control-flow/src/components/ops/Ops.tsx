import React, { useEffect, useState } from 'react';
import { Fieldset } from 'primereact/fieldset';
import SwitchEnable from '../../shared/SwitchEnable';
import { useApp } from '../../provider/MifProvider';
import { useControlFlow } from '../../provider/ControlFlowProvider';
import { Tooltip } from 'primereact/tooltip';

export default function Ops(props: { className?: string }) {
    const { getSpr4Values, patchMrpfVariable} = useApp();
    const { loading, dataStm, error } = getSpr4Values();
    const [stmMap, setStmMap] = useState<Record<string, string | boolean>>({});
    const [isStmProcessingChecked, setIsStmProcessingChecked] = useState<boolean>(!!stmMap['MAIN_PROCESSING']);
    
    // Get control flow state from our provider
    const { 
        setNavSystemEnabled,
        setSonarDataEnabled, 
        setAcousticDataEnabled, 
        setTelemetryDataEnabled 
    } = useControlFlow();
    
    useEffect(() => {    
        const stmMap: Record<string, string | boolean> = {};

        if (dataStm) {
            dataStm.forEach((item: { key:string, value:string, readOnly: boolean }) => {
                if (!item.key.includes("LAST_PACKET_TIME")) {
                    stmMap[item.key] = item.value.toLowerCase() === "enabled";
                }
                setStmMap(stmMap);
            });
            setIsStmProcessingChecked(!!stmMap["MAIN_PROCESSING"]);
        }
    }, [dataStm]);

    const handleMainProcessingSwitchChange = async (key: string, value: boolean) => {
        setIsStmProcessingChecked(value);
        // Update the NavSystem state in ControlFlowProvider
        setNavSystemEnabled(value);

        if (value === false) {
            await Promise.all([
                patchMrpfVariable('MRM_PROCESSING', 'false'),
                patchMrpfVariable('MSBD_PROCESSING', 'false'),
                patchMrpfVariable('MRPF_PROCESSING', 'false'),
            ]);
    
            // Update stmMap and set other switches to false
            setStmMap(prev => ({
                ...prev,
                'MRM_PROCESSING': false,
                'MSBD_PROCESSING': false,
                'MRPF_PROCESSING': false,
                [key]: value,
            }));
            
            // Also update the other states in ControlFlowProvider
            setSonarDataEnabled(false);
            setAcousticDataEnabled(false);
            setTelemetryDataEnabled(false);
        } else {
            setStmMap(prev => ({ ...prev, [key]: value }));
        }
    };
    
    const handleOtherSwitchChange = (key: string, value: boolean) => {
        setStmMap(prev => ({ ...prev, [key]: value }));
        
        // Update corresponding states in ControlFlowProvider
        switch(key) {
            case 'MRM_PROCESSING':
                setSonarDataEnabled(value);
                break;
            case 'MSBD_PROCESSING':
                setAcousticDataEnabled(value);
                break;
            case 'MRPF_PROCESSING':
                setTelemetryDataEnabled(value);
                break;
        }
    };
    
    return (
        <div className={`card ${props.className}`}>
            <Tooltip target=".switch-tooltip" position="left" />
            <Fieldset legend="Ops Configuration" toggleable className='m-2' pt={{
                content: { className: 'py-0' },
            }}>
                <div className="flex align-items-end">
                    <div className="switch-tooltip">
                        <SwitchEnable 
                            configuration='Enhance Main Navigation Controls'
                            configurationApi="MAIN_PROCESSING"
                            checked={!!stmMap["MAIN_PROCESSING"]} 
                            loading={loading}
                            error={error}
                            callbackPatch={patchMrpfVariable}
                            onToggle={handleMainProcessingSwitchChange}/>
                    </div>
                </div>
                <div className="switch-tooltip">
                    <SwitchEnable 
                        configuration='Enable Sonar Processing Tools' 
                        configurationApi="MRM_PROCESSING"
                        checked={!!stmMap["MRM_PROCESSING"]} 
                        loading={loading}
                        disabled={!isStmProcessingChecked}
                        error={error}
                        callbackPatch={patchMrpfVariable}
                        onToggle={handleOtherSwitchChange}/>
                </div>
                <div className="switch-tooltip">
                    <SwitchEnable 
                        configuration='Activate Acoustic Analysis Module' 
                        configurationApi="MSBD_PROCESSING"
                        checked={!!stmMap["MSBD_PROCESSING"]} 
                        loading={loading}
                        disabled={!isStmProcessingChecked}
                        error={error}
                        callbackPatch={patchMrpfVariable}
                        onToggle={handleOtherSwitchChange}/>
                </div>
                <div className="switch-tooltip">
                    <SwitchEnable 
                        configuration='Enable Telemetry Monitoring System' 
                        configurationApi="MRPF_PROCESSING"
                        checked={!!stmMap["MRPF_PROCESSING"]} 
                        loading={loading}
                        disabled={!isStmProcessingChecked}
                        error={error}
                        callbackPatch={patchMrpfVariable}
                        onToggle={handleOtherSwitchChange}/>
                </div>
            </Fieldset>
        </div>
    )
}
