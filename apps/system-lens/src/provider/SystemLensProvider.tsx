import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SystemLensContextType {
  systemData: any[];
  setSystemData: (data: any[]) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

const SystemLensContext = createContext<SystemLensContextType | undefined>(undefined);

interface SystemLensProviderProps {
  children: ReactNode;
}

const SystemLensProvider: React.FC<SystemLensProviderProps> = ({ children }) => {
  const [systemData, setSystemData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const value = {
    systemData,
    setSystemData,
    loading,
    setLoading,
    error,
    setError
  };

  return (
    <SystemLensContext.Provider value={value}>
      {children}
    </SystemLensContext.Provider>
  );
};

export const useSystemLens = (): SystemLensContextType => {
  const context = useContext(SystemLensContext);
  if (context === undefined) {
    throw new Error('useSystemLens must be used within a SystemLensProvider');
  }
  return context;
};

export default SystemLensProvider; 