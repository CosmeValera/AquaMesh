import React, { useEffect, useRef, useState } from 'react';
import SwitchEnable from '../../shared/SwitchEnable';
import { Fieldset } from 'primereact/fieldset';
import { useApp } from '../../provider/MifProvider';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { useControlFlow } from '../../provider/ControlFlowProvider';

import styles from '../main-configuration/main-configuration.module.scss';

export default function SubSysStat(props: { className?: string }) {
    const { getMSubStatValues, patchMrpfVariable} = useApp();
	const toast = useRef<Toast>(null);
    const { loading, dataMm, error } = getMSubStatValues();
    const [MMsatStatMap, setMMsatStatMap] = useState<Record<string, string | boolean>>({});

    // Get control flow states from the provider
    const { 
        sonarDataEnabled, 
        acousticDataEnabled, 
        telemetryDataEnabled 
    } = useControlFlow();

    useEffect(() => {    
        const MMsatStatMap: Record<string, string | boolean> = {};
        if (dataMm) {
            dataMm.forEach((item: { key:string, value:string, readOnly: boolean }) => {
                MMsatStatMap[item.key] = item.value.toLowerCase() === "enabled";    
            });
            setMMsatStatMap(MMsatStatMap);
        }
    }, [dataMm]);
    
    const handleSwitchChange = (key: string, value: boolean) => {
        setMMsatStatMap(prev => ({ ...prev, [key]: value }));
    };

    // Determine if in danger mode
    const isDangerMode = !!MMsatStatMap["MMSATSTAT_PROCESSING"];

    // Determine which subsystems are active based on the Control Flow state
    const activeSubsystems = [
        sonarDataEnabled ? "sonar" : null,
        acousticDataEnabled ? "acoustic" : null,
        telemetryDataEnabled ? "telemetry" : null
    ].filter(Boolean);

    // Function to render appropriate buttons based on active subsystems
    const renderButtons = () => {
        if (isDangerMode) {
            return renderDangerButtons();
        } else {
            return renderNormalButtons();
        }
    };

    const renderNormalButtons = () => {
        // Show specific buttons for active subsystems
        const buttons = [];
        
        if (activeSubsystems.length === 0) {
            buttons.push(
                <Button key="comms" label="Establish Comms" rounded className={styles['cf-button']} onClick={()=>{
                    toast.current?.show({ severity: 'success', summary: 'Comms Established', detail: <p>Communication relay successfully deployed!</p>, life: 3000 });
                }}/>
            );
            
            buttons.push(
                <Button key="sensors" label="Activate Sensors" rounded className={styles['cf-button']} onClick={()=>{
                    toast.current?.show({ severity: 'success', summary: 'Sensors Activated', detail: <p>Acoustic signal transmitted, awaiting return data!</p>, life: 3000 });
                }}/>
            );
        } else {
            if (sonarDataEnabled) {
                buttons.push(
                    <Button key="sonar" severity="success" label="Process Sonar Data" rounded className={`${styles['cf-button']} ${styles.enhance}`} onClick={()=>{
                        toast.current?.show({ severity: 'success', summary: 'Sonar Processing', detail: <p>Sonar data stream analysis in progress!</p>, life: 3000 });
                    }}/>
                );
            }
            
            if (acousticDataEnabled) {
                buttons.push(
                    <Button key="acoustic" severity="success" label="Analyze Acoustic Signals" rounded className={`${styles['cf-button']} ${styles.enhance}`} onClick={()=>{
                        toast.current?.show({ severity: 'success', summary: 'Acoustic Analysis', detail: <p>Acoustic signatures being processed and identified!</p>, life: 3000 });
                    }}/>
                );
            }
            
            if (telemetryDataEnabled) {
                buttons.push(
                    <Button key="telemetry" severity="success" label="Monitor Telemetry" rounded className={`${styles['cf-button']} ${styles.enhance}`} onClick={()=>{
                        toast.current?.show({ severity: 'success', summary: 'Telemetry Monitoring', detail: <p>Real-time telemetry data stream established!</p>, life: 3000 });
                    }}/>
                );
            }
        }
        
        return buttons;
    };

    const renderDangerButtons = () => {
        // Show specific buttons for active subsystems in danger mode
        const buttons = [];
        
        if (activeSubsystems.length === 0) {
            buttons.push(
                <Button key="emergency" severity="danger" label="Emergency Dive" rounded className={`${styles['cf-button']} ${styles.danger}`} onClick={()=>{
                    toast.current?.show({ severity: 'warn', summary: 'DANGER MODE', detail: <p>Emergency dive protocol initiated!</p>, life: 3000 });
                }}/>
            );
            
            buttons.push(
                <Button key="countermeasures" severity="danger" label="Deploy Countermeasures" rounded className={`${styles['cf-button']} ${styles.danger}`} onClick={()=>{
                    toast.current?.show({ severity: 'warn', summary: 'DANGER MODE', detail: <p>Acoustic countermeasures deployed!</p>, life: 3000 });
                }}/>
            );
        } else {
            if (sonarDataEnabled) {
                buttons.push(
                    <Button key="sonar-danger" severity="danger" label="Sonar Stealth Mode" rounded className={`${styles['cf-button']} ${styles.danger}`} onClick={()=>{
                        toast.current?.show({ severity: 'warn', summary: 'DANGER MODE', detail: <p>Sonar in passive detection mode only!</p>, life: 3000 });
                    }}/>
                );
            }
            
            if (acousticDataEnabled) {
                buttons.push(
                    <Button key="acoustic-danger" severity="danger" label="Acoustic Jamming" rounded className={`${styles['cf-button']} ${styles.danger}`} onClick={()=>{
                        toast.current?.show({ severity: 'warn', summary: 'DANGER MODE', detail: <p>Initiating acoustic jamming sequence!</p>, life: 3000 });
                    }}/>
                );
            }
            
            if (telemetryDataEnabled) {
                buttons.push(
                    <Button key="telemetry-danger" severity="danger" label="Encrypt Telemetry" rounded className={`${styles['cf-button']} ${styles.danger}`} onClick={()=>{
                        toast.current?.show({ severity: 'warn', summary: 'DANGER MODE', detail: <p>All telemetry streams now fully encrypted!</p>, life: 3000 });
                    }}/>
                );
            }
        }
        
        return buttons;
    };

    return (
        <div className={`card ${props.className}`}>
            <Fieldset legend="SubSysStat Configuration" toggleable className='m-2' pt={{
                content: { className: 'py-0' },
            }}>
                <Toast ref={toast} />
                <SwitchEnable
                    configuration="Danger Mode"
                    configurationApi="MMSATSTAT_PROCESSING"
                    checked={isDangerMode} 
                    loading={loading}
                    error={error}
                    callbackPatch={patchMrpfVariable}
                    onToggle={handleSwitchChange}
                />
                <div className="flex gap-6 mt-3 flex-wrap">
                    {renderButtons()}
                </div>
            </Fieldset>
        </div>
    )
}
