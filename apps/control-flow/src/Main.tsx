import React from 'react';
import { PrimeReactProvider } from 'primereact/api';

import '../../../style/themes/aquamesh-theme/theme.scss';
import 'primereact/resources/themes/lara-dark-green/theme.css';
import 'primereact/resources/primereact.css';
import 'primeflex/primeflex.css';
import 'primeicons/primeicons.css';
import "./hide-overlay.scss";

import MifProvider from './provider/MifProvider';
import { ControlFlowProvider } from './provider/ControlFlowProvider';
import AquameshPage from './pages/AquaMeshPage';

const Main = () => {
  return (
    <PrimeReactProvider value={{ ripple: true }}>
      <MifProvider aquamesh="316">
        <ControlFlowProvider>
          <AquameshPage />
        </ControlFlowProvider>
      </MifProvider>
    </PrimeReactProvider>
  );
};

export default Main;