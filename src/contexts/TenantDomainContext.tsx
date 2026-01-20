import React, { createContext, useContext, ReactNode } from 'react';
import { useTenantDomain, DomainResolution } from '@/hooks/useTenantDomain';

const TenantDomainContext = createContext<DomainResolution | null>(null);

interface TenantDomainProviderProps {
  children: ReactNode;
}

export function TenantDomainProvider({ children }: TenantDomainProviderProps) {
  const domainResolution = useTenantDomain();
  
  return (
    <TenantDomainContext.Provider value={domainResolution}>
      {children}
    </TenantDomainContext.Provider>
  );
}

export function useTenantDomainContext(): DomainResolution {
  const context = useContext(TenantDomainContext);
  if (!context) {
    throw new Error('useTenantDomainContext must be used within TenantDomainProvider');
  }
  return context;
}
