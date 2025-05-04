import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { SystemData } from '../types/systemTypes'
import { fetchSystemData, refreshSystemData, updateSystem } from '../api/systemApi'

// Define the context type
interface SystemLensContextType {
  systemData: SystemData[]
  setSystemData: React.Dispatch<React.SetStateAction<SystemData[]>>
  loading: boolean
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
  error: string | null
  setError: React.Dispatch<React.SetStateAction<string | null>>
  refreshData: () => Promise<void>
  updateSystemStatus: (id: number, status: string) => Promise<void>
}

// Create the context with default values
const SystemLensContext = createContext<SystemLensContextType | undefined>(undefined)

// Props for the provider component
interface SystemLensProviderProps {
  children: ReactNode
}

export function SystemLensProvider({ children }: SystemLensProviderProps) {
  const [systemData, setSystemData] = useState<SystemData[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Load initial data
  useEffect(() => {
    loadSystemData()
  }, [])

  // Function to load system data
  const loadSystemData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const data = await fetchSystemData()
      setSystemData(data)
    } catch (err) {
      setError('Failed to load system data. Please try again later.')
      console.error('Error loading system data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Function to refresh system data
  const refreshData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const data = await refreshSystemData()
      setSystemData(data)
    } catch (err) {
      setError('Failed to refresh system data. Please try again later.')
      console.error('Error refreshing system data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Function to update a system's status
  const updateSystemStatus = async (id: number, status: string) => {
    setError(null)
    
    try {
      const updatedSystem = await updateSystem(id, { status })
      
      // Update the system in our local state
      setSystemData(prev => 
        prev.map(system => 
          system.id === id ? updatedSystem : system
        )
      )
    } catch (err) {
      setError(`Failed to update system status. Please try again later.`)
      console.error('Error updating system status:', err)
    }
  }

  // Create the context value object
  const value: SystemLensContextType = {
    systemData,
    setSystemData,
    loading,
    setLoading,
    error,
    setError,
    refreshData,
    updateSystemStatus,
  }

  return (
    <SystemLensContext.Provider value={value}>
      {children}
    </SystemLensContext.Provider>
  )
}

// Custom hook to use the SystemLens context
export function useSystemLens() {
  const context = useContext(SystemLensContext)
  
  if (context === undefined) {
    throw new Error('useSystemLens must be used within a SystemLensProvider')
  }
  
  return context
} 