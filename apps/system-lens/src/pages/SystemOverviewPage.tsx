import React from 'react'
import { useSystemLens } from '../provider/SystemLensProvider'
import { 
  ContainerBreakpointProvider, 
  ContainerVisible, 
  CQ 
} from '../components/ContainerResponsive'
import ResourceCard from '../components/ResourceCard'
import StatusBadge from '../components/StatusBadge'
import SystemStatusCard from '../components/SystemStatusCard'
import SystemCard from '../components/SystemCard'
import SystemTable from '../components/SystemTable'
import SystemResourceChart from '../components/SystemResourceChart'

const SystemOverviewPage: React.FC = () => {
  const { 
    systemData, 
    loading, 
    error, 
    refreshData,
    updateSystemStatus
  } = useSystemLens()

  // Calculate average usage values
  const avgCpuUsage = (systemData.reduce((acc, curr) => acc + curr.cpu, 0) / systemData.length || 0).toFixed(1)
  const avgMemoryUsage = (systemData.reduce((acc, curr) => acc + curr.memory, 0) / systemData.length || 0).toFixed(1)

  // Action handlers
  const handleSystemAction = (id: number) => {
    const system = systemData.find(sys => sys.id === id)
    if (!system) return
    
    // For demo purposes, toggle the system status when the action button is clicked
    let newStatus: string
    
    switch (system.status) {
      case 'Online':
        newStatus = 'Warning'
        break
      case 'Warning':
        newStatus = 'Offline'
        break
      case 'Offline':
        newStatus = 'Online'
        break
      default:
        newStatus = 'Online'
    }
    
    updateSystemStatus(id, newStatus)
  }

  // Handle refresh button click
  const handleRefresh = () => {
    refreshData()
  }

  // Handle error display
  const renderErrorMessage = () => {
    if (!error) return null
    
    return (
      <div className="p-3 bg-red-100 text-red-800 border border-red-200 rounded mb-4">
        <div className="flex align-items-center">
          <i className="pi pi-exclamation-triangle mr-2"></i>
          <span>{error}</span>
        </div>
      </div>
    )
  }

  return (
    <ContainerBreakpointProvider className="p-4 bg-teal-900">
      <div className="flex align-items-center justify-content-between mb-4">
        <h1 className="text-3xl font-bold text-primary m-0">System Overview</h1>
        <div className="flex align-items-center gap-2">
          <button 
            className="p-button p-button-outlined"
            onClick={handleRefresh}
            disabled={loading}
          >
            <i className={`pi ${loading ? 'pi-spin pi-spinner' : 'pi-refresh'} mr-2`}></i>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="p-button p-button-primary">
            <i className="pi pi-cog mr-2"></i>
            Settings
          </button>
        </div>
      </div>
      
      {/* Display error message if any */}
      {renderErrorMessage()}
      
      <div className="grid">
        {/* Summary Cards */}
        <div className={`${CQ.col12} ${CQ.lg.col4}`}>
          <SystemStatusCard systemData={systemData} />
        </div>

        <div className={`${CQ.col12} ${CQ.lg.col4}`}>
          <ResourceCard 
            title="CPU Usage"
            icon={<i className="pi pi-database"></i>}
            value={`${avgCpuUsage}%`}
            resourceColor="bg-blue-500"
            progressValue={parseFloat(avgCpuUsage)}
            iconColor="blue-500"
          />
        </div>

        <div className={`${CQ.col12} ${CQ.lg.col4}`}>
          <ResourceCard 
            title="Memory Usage"
            icon={<i className="pi pi-microchip"></i>}
            value={`${avgMemoryUsage}%`}
            resourceColor="bg-purple-500"
            progressValue={parseFloat(avgMemoryUsage)}
            iconColor="purple-500"
          />
        </div>

        {/* Data Table */}
        <div className={`${CQ.col12} mt-4`}>
          <div className="card p-4">
            <div className="card-header flex justify-content-between align-items-center">
              <h3 className="text-xl font-medium m-0">System Status</h3>
              <div className="flex align-items-center gap-2">
                <button className="p-button p-button-text">
                  <i className="pi pi-filter"></i>
                </button>
                <button className="p-button p-button-text">
                  <i className="pi pi-download"></i>
                </button>
              </div>
            </div>
            <div className="card-body p-0">
              {loading ? (
                <div className="flex align-items-center justify-content-center p-5">
                  <div className="p-progress-spinner mr-3">
                    <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }}></i>
                  </div>
                  <span className="text-lg">Loading system data...</span>
                </div>
              ) : (
                <>
                  {/* Mobile Card View (for xs containers) */}
                  <ContainerVisible breakpoint="xs" condition="only">
                    <div className="p-3">
                      {systemData.length === 0 ? (
                        <div className="text-center p-3">No system data available</div>
                      ) : (
                        systemData.map(item => (
                          <SystemCard 
                            key={item.id} 
                            system={item} 
                            onAction={() => handleSystemAction(item.id)}
                          />
                        ))
                      )}
                    </div>
                  </ContainerVisible>

                  {/* Small Container View (compact table) */}
                  <ContainerVisible breakpoint="sm" condition="only">
                    <SystemTable 
                      systemData={systemData} 
                      isCompact={true}
                      onAction={handleSystemAction}
                    />
                  </ContainerVisible>

                  {/* Medium and up Container View (full table) */}
                  <ContainerVisible breakpoint="md" condition="up">
                    <SystemTable 
                      systemData={systemData}
                      onAction={handleSystemAction}
                    />
                  </ContainerVisible>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className={`${CQ.col12} mt-4`}>
          <SystemResourceChart systemData={systemData} />
        </div>
      </div>
    </ContainerBreakpointProvider>
  )
}

export default SystemOverviewPage 