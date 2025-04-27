import React from 'react';
import { PrimeReactProvider } from 'primereact/api';

// Import styles
import '../../../style/themes/aquamesh-theme/theme.scss';
import 'primereact/resources/primereact.css';
import 'primeflex/primeflex.css';
import 'primeicons/primeicons.css';
import './hide-overlay.scss';
import './components/container-responsive.scss';

import SystemLensProvider from './provider/SystemLensProvider';
import SystemOverviewPage from './pages/SystemOverviewPage';

const Main = () => {
  return (
    <PrimeReactProvider value={{ ripple: true }}>
      <SystemLensProvider>
        <SystemOverviewPage />
      </SystemLensProvider>
    </PrimeReactProvider>
  );
};

export default Main; 