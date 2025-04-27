import React, {useRef, useState, useEffect} from 'react'; 
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { Fieldset } from 'primereact/fieldset';
import SwitchEnable from '../../shared/SwitchEnable';
import { useControlFlow } from '../../provider/ControlFlowProvider';

import styles from './main-configuration.module.scss';

export default function MainConfiguration() {
	const toast = useRef<Toast>(null);
	const [dangerMode, setDangerMode] = useState<boolean>(false);
	const { navSystemEnabled } = useControlFlow();
	
	const handleSwitchChange = (key: string, value: boolean) => {
		setDangerMode(value);
	};

	// Mock API function to simulate patchMrpfVariable behavior
	const mockpatchMrpfVariable = async (key: string, value: string) => {
		// await new Promise(resolve => setTimeout(resolve, 0));
		return true;
	};
	
	return (
		<div className={`card`}>
			<Fieldset legend="Main Configuration" toggleable className='m-2' pt={{
				content: { className: 'py-0' },
			}}>
				<Toast ref={toast} />
				<SwitchEnable
					configuration="Danger Mode"
					configurationApi="MAIN_DANGER_MODE"
					checked={dangerMode} 
					loading={false}
					error={false}
					callbackPatch={mockpatchMrpfVariable}
					onToggle={handleSwitchChange}
				/>
				<div className="flex gap-6 mt-3 flex-wrap">
					{!dangerMode ? (
						<>
							{navSystemEnabled ? (
								<>
									<Button label="Enhanced Depth Control" severity="success" className={`${styles['cf-button']} ${styles.enhance}`} onClick={()=>{
										toast.current?.show({ severity: 'success', summary: 'Nav System Online', detail: <p>Enhanced depth control engaged with navigation support!</p>, life: 3000 });
									}}/>
									<Button label="Track Vehicle Position" severity="success" className={`${styles['cf-button']} ${styles.enhance}`} onClick={()=>{
										toast.current?.show({ severity: 'success', summary: 'Nav System Online', detail: <p>Vehicle position tracking enhanced by navigation systems!</p>, life: 3000 });
									}}/>
									<Button label="Optimize Route" severity="success" className={`${styles['cf-button']} ${styles.enhance}`} onClick={()=>{
										toast.current?.show({ severity: 'success', summary: 'Nav System Online', detail: <p>Route optimization using navigation telemetry!</p>, life: 3000 });
									}}/>
								</>
							) : (
								<>
									<Button label="Adjust Depth" className={styles['cf-button']} onClick={()=>{
										toast.current?.show({ severity: 'success', summary: 'Depth Adjustment', detail: <p>System transitioning to operational depth!</p>, life: 3000 });
									}}/>
									<Button label="Launch Sonar" className={styles['cf-button']} onClick={()=>{
										toast.current?.show({ severity: 'success', summary: 'Sonar Activated', detail: <p>Sonar ping sent, awaiting echo response!</p>, life: 3000 });
									}}/>
									<Button label="Return to Base" className={styles['cf-button']} onClick={()=>{
										toast.current?.show({ severity: 'success', summary: 'Return Sequence', detail: <p>System initiating return protocol!</p>, life: 3000 });
									}}/>
								</>
							)}
						</>
					) : (
						<>
							{navSystemEnabled ? (
								<>
									<Button severity="danger" label="Emergency Descent Override" className={`${styles['cf-button']} ${styles.danger}`} onClick={()=>{
										toast.current?.show({ severity: 'warn', summary: 'DANGER MODE WITH NAV', detail: <p>Emergency descent with navigation guidance!</p>, life: 3000 });
									}}/>
									<Button severity="danger" label="Stealth Navigation" className={`${styles['cf-button']} ${styles.danger}`} onClick={()=>{
										toast.current?.show({ severity: 'warn', summary: 'DANGER MODE WITH NAV', detail: <p>Stealth navigation engaged with minimal emissions!</p>, life: 3000 });
									}}/>
									<Button severity="danger" label="Critical Systems Override" className={`${styles['cf-button']} ${styles.danger}`} onClick={()=>{
										toast.current?.show({ severity: 'warn', summary: 'DANGER MODE WITH NAV', detail: <p>Critical systems running with navigation support!</p>, life: 3000 });
									}}/>
								</>
							) : (
								<>
									<Button severity="danger" label="Emergency Ballast" className={`${styles['cf-button']} ${styles.danger}`} onClick={()=>{
										toast.current?.show({ severity: 'warn', summary: 'DANGER MODE', detail: <p>Emergency ballast system engaged!</p>, life: 3000 });
									}}/>
									<Button severity="danger" label="Silent Running" className={`${styles['cf-button']} ${styles.danger}`} onClick={()=>{
										toast.current?.show({ severity: 'warn', summary: 'DANGER MODE', detail: <p>All non-essential systems powered down!</p>, life: 3000 });
									}}/>
									<Button severity="danger" label="Evasive Maneuvers" className={`${styles['cf-button']} ${styles.danger}`} onClick={()=>{
										toast.current?.show({ severity: 'warn', summary: 'DANGER MODE', detail: <p>Random depth and course changes initiated!</p>, life: 3000 });
									}}/>
								</>
							)}
						</>
					)}
				</div>
			</Fieldset>
		</div>
	)
}