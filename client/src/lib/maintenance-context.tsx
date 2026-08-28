"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface MaintenanceContextType {
  isMaintenance: boolean;
  setMaintenance: (value: boolean) => void;
}

const MaintenanceContext = createContext<MaintenanceContextType>({
  isMaintenance: false,
  setMaintenance: () => {},
});

export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const [isMaintenance, setIsMaintenance] = useState(false);

  const setMaintenance = useCallback((value: boolean) => {
    setIsMaintenance(value);
  }, []);

  return (
    <MaintenanceContext.Provider value={{ isMaintenance, setMaintenance }}>
      {children}
    </MaintenanceContext.Provider>
  );
}

export const useMaintenance = () => useContext(MaintenanceContext);
