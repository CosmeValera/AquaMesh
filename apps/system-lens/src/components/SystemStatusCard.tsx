import React from 'react'
import { SystemData } from '../types/systemTypes'

interface SystemStatusCardProps {
  systemData: SystemData[]
}

const SystemStatusCard: React.FC<SystemStatusCardProps> = ({ systemData }) => {
  return (
    <div className="card border-1 border-50 h-full p-4">
      <div className="flex align-items-center justify-content-between mb-3">
        <div className="flex align-items-center">
          <i className="pi pi-server text-primary mr-2" style={{ fontSize: '1.5rem' }}></i>
          <span className="text-xl font-medium">Total Systems</span>
        </div>
        <span className="text-4xl font-bold">{systemData.length}</span>
      </div>
      <div className="mt-4">
        <div className="flex justify-content-between align-items-center mb-2">
          <span className="text-600">Online</span>
          <span className="p-tag p-tag-success">{systemData.filter(s => s.status === 'Online').length}</span>
        </div>
        <div className="flex justify-content-between align-items-center mb-2">
          <span className="text-600">Warning</span>
          <span className="p-tag p-tag-warning">{systemData.filter(s => s.status === 'Warning').length}</span>
        </div>
        <div className="flex justify-content-between align-items-center">
          <span className="text-600">Offline</span>
          <span className="p-tag p-tag-danger">{systemData.filter(s => s.status === 'Offline').length}</span>
        </div>
      </div>
    </div>
  )
}

export default SystemStatusCard 