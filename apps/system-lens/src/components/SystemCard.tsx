import React from 'react'
import { SystemData } from '../types/systemTypes'
import StatusBadge from './StatusBadge'

interface SystemCardProps {
  system: SystemData
  onAction: () => void
}

const SystemCard: React.FC<SystemCardProps> = ({ system, onAction }) => {
  // Progress bar template for resource usage
  const resourceProgressBar = (value: number, color: string) => {
    return (
      <div className="w-full surface-200 border-round overflow-hidden" style={{ height: '0.5rem' }}>
        <div className={color} style={{ width: `${value}%`, height: '100%' }}></div>
      </div>
    )
  }

  return (
    <div className="card mb-3 p-3 border-1 border-50 bg-teal-900">
      <div className="flex justify-content-between align-items-center mb-3">
        <span className="font-medium text-lg">{system.name}</span>
        <StatusBadge status={system.status} />
      </div>
      <div className="grid">
        <div className="col-6 mb-2">
          <div className="text-sm text-500">CPU</div>
          <div className="flex align-items-center mt-1">
            <span className="mr-2">{system.cpu}%</span>
            {resourceProgressBar(system.cpu, 'bg-blue-500')}
          </div>
        </div>
        <div className="col-6 mb-2">
          <div className="text-sm text-500">Memory</div>
          <div className="flex align-items-center mt-1">
            <span className="mr-2">{system.memory}%</span>
            {resourceProgressBar(system.memory, 'bg-purple-500')}
          </div>
        </div>
        <div className="col-12 mb-2">
          <div className="text-sm text-500">Network</div>
          <div className="flex align-items-center mt-1">
            <span className="mr-2">{system.network}%</span>
            {resourceProgressBar(system.network, 'bg-orange-500')}
          </div>
        </div>
      </div>
      <div className="flex justify-content-end mt-2">
        <button className="p-button p-button-rounded p-button-text" onClick={onAction}>
          <i className="pi pi-cog"></i>
        </button>
      </div>
    </div>
  )
}

export default SystemCard 