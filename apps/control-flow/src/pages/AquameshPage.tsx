import React from 'react';

import SubSysStat from '../components/subsysstat/SubSysStat';
import Ops from '../components/ops/Ops';
import MainConfiguration from '../components/main-configuration/MainConfiguration';

const AquameshPage = () => {
  return (
    <div className="card min-h-full bg-teal-900 p-6 flex flex-column gap-3">
      <MainConfiguration />
      <SubSysStat />
      <Ops />
    </div>
  );
}

export default AquameshPage;