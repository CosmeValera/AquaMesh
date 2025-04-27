import React, { createContext, useContext, ReactNode, useState } from "react";

type ControlFlowContextType = {
  navSystemEnabled: boolean;
  sonarDataEnabled: boolean;
  acousticDataEnabled: boolean;
  telemetryDataEnabled: boolean;
  setNavSystemEnabled: (value: boolean) => void;
  setSonarDataEnabled: (value: boolean) => void;
  setAcousticDataEnabled: (value: boolean) => void;
  setTelemetryDataEnabled: (value: boolean) => void;
};

const ControlFlowContext = createContext<ControlFlowContextType | undefined>(undefined);

type ControlFlowProviderProps = {
  children: ReactNode;
};

export function ControlFlowProvider({ children }: ControlFlowProviderProps) {
  const [navSystemEnabled, setNavSystemEnabled] = useState<boolean>(false);
  const [sonarDataEnabled, setSonarDataEnabled] = useState<boolean>(false);
  const [acousticDataEnabled, setAcousticDataEnabled] = useState<boolean>(false);
  const [telemetryDataEnabled, setTelemetryDataEnabled] = useState<boolean>(false);

  const value: ControlFlowContextType = {
    navSystemEnabled,
    sonarDataEnabled,
    acousticDataEnabled,
    telemetryDataEnabled,
    setNavSystemEnabled,
    setSonarDataEnabled,
    setAcousticDataEnabled,
    setTelemetryDataEnabled,
  };

  return (
    <ControlFlowContext.Provider value={value}>
      {children}
    </ControlFlowContext.Provider>
  );
}

export function useControlFlow() {
  const context = useContext(ControlFlowContext);
  if (context === undefined) {
    throw new Error("useControlFlow must be used within a ControlFlowProvider");
  }
  return context;
} 