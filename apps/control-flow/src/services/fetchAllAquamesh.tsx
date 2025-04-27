interface ProcessData {
  key: string;
  value: string;
  readOnly: boolean;
}

const fetchGetOneAquamesh = async (aquamesh: string) => {
  // Mock data for the application
  return [
    {
      key: 'MAIN_PROCESSING',
      value: 'DISABLED',
      readOnly: false
    },
    {
      key: 'MRPF_PROCESSING',
      value: 'DISABLED',
      readOnly: false
    },
    {
      key: 'MRM_PROCESSING',
      value: 'DISABLED',
      readOnly: false
    },
    {
      key: 'MSBD_PROCESSING',
      value: 'DISABLED',
      readOnly: false
    },
    {
      key: 'MMSATSTAT_PROCESSING',
      value: 'DISABLED',
      readOnly: false
    }
  ]
}
  
export const fetchGetAllAquamesh = async (aquameshs: string[]): Promise<ProcessData[][]> => {
  const promises: Promise<ProcessData[]>[] = aquameshs.map(aquamesh => fetchGetOneAquamesh(aquamesh));
  return await Promise.all(promises);
};
      