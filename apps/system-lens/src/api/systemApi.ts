import { SystemData } from '../types/systemTypes'

// Base API URL - this would be replaced with your actual API URL
const BASE_URL = '/api'

// Mock data for development
const MOCK_DATA: SystemData[] = [
  { id: 1, name: 'App Server', status: 'Online', cpu: 12, memory: 42, network: 56 },
  { id: 2, name: 'Database Server', status: 'Online', cpu: 34, memory: 58, network: 23 },
  { id: 3, name: 'Storage Server', status: 'Warning', cpu: 67, memory: 75, network: 45 },
  { id: 4, name: 'Backup Server', status: 'Offline', cpu: 0, memory: 0, network: 0 },
  { id: 5, name: 'Web Server', status: 'Online', cpu: 28, memory: 36, network: 82 },
  { id: 6, name: 'API Gateway', status: 'Online', cpu: 15, memory: 28, network: 62 },
  { id: 7, name: 'Cache Server', status: 'Warning', cpu: 72, memory: 64, network: 31 }
]

// Determine if we should use mock data or real API
const USE_MOCK = true

/**
 * Fetch system data from the API
 * @returns Promise with SystemData array
 */
export const fetchSystemData = async (): Promise<SystemData[]> => {
  if (USE_MOCK) {
    // Simulate API delay
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(MOCK_DATA)
      }, 1000)
    })
  }
  
  try {
    const response = await fetch(`${BASE_URL}/systems`)
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching system data:', error)
    throw error
  }
}

/**
 * Refresh system data (simulates a refresh operation)
 * @returns Promise with updated SystemData array
 */
export const refreshSystemData = async (): Promise<SystemData[]> => {
  if (USE_MOCK) {
    // For mocked data, we'll generate some random changes to simulate refreshing
    return new Promise((resolve) => {
      setTimeout(() => {
        const refreshedData = MOCK_DATA.map(system => ({
          ...system,
          cpu: system.status !== 'Offline' ? Math.min(100, Math.max(1, system.cpu + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 10))) : 0,
          memory: system.status !== 'Offline' ? Math.min(100, Math.max(1, system.memory + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 8))) : 0,
          network: system.status !== 'Offline' ? Math.min(100, Math.max(1, system.network + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 15))) : 0
        }))
        resolve(refreshedData)
      }, 1000)
    })
  }
  
  // In a real application, this would call the API again
  return fetchSystemData()
}

/**
 * Update a system (simulated for mock data)
 * @param id System ID to update
 * @param data Updated system data
 * @returns Promise with updated system
 */
export const updateSystem = async (id: number, data: Partial<SystemData>): Promise<SystemData> => {
  if (USE_MOCK) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const systemIndex = MOCK_DATA.findIndex(system => system.id === id)
        if (systemIndex === -1) {
          reject(new Error(`System with ID ${id} not found`))
          return
        }
        
        // Update the system in our mock data
        const updatedSystem = {
          ...MOCK_DATA[systemIndex],
          ...data
        }
        MOCK_DATA[systemIndex] = updatedSystem
        
        resolve(updatedSystem)
      }, 500)
    })
  }
  
  try {
    const response = await fetch(`${BASE_URL}/systems/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error(`Error updating system ${id}:`, error)
    throw error
  }
} 