import React from 'react'
import { SystemData } from '../types/systemTypes'
import StatusBadge from './StatusBadge'

interface SystemTableProps {
  systemData: SystemData[]
  isCompact?: boolean
  onAction: (id: number) => void
}

const SystemTable: React.FC<SystemTableProps> = ({ 
  systemData, 
  isCompact = false,
  onAction 
}) => {
  // Progress bar template for resource usage
  const resourceProgressBar = (value: number, color: string) => {
    return (
      <div className="w-full surface-200 border-round overflow-hidden" style={{ height: '0.5rem' }}>
        <div className={color} style={{ width: `${value}%`, height: '100%' }}></div>
      </div>
    )
  }

  // Action button template
  const actionButtonTemplate = (id: number) => {
    return (
      <button className="p-button p-button-rounded p-button-text" onClick={() => onAction(id)}>
        <i className="pi pi-cog"></i>
      </button>
    )
  }

  if (isCompact) {
    // Compact table (SM breakpoint)
    return (
      <div className="p-datatable p-component overflow-x-auto">
        <div className="p-datatable-wrapper flex justify-content-center">
          <table className="p-datatable-table w-full pt-5">
            <thead className="p-datatable-thead">
              <tr>
                <th style={{ width: '5%' }}>ID</th>
                <th style={{ width: '35%' }}>System Name</th>
                <th style={{ width: '20%' }}>Status</th>
                <th style={{ width: '20%' }}>Resource</th>
                <th style={{ width: '20%' }}>Actions</th>
              </tr>
            </thead>
            <tbody className="p-datatable-tbody">
              {systemData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center">No system data available</td>
                </tr>
              ) : (
                systemData.map(item => (
                  <tr key={item.id} className="p-selectable-row">
                    <td>{item.id}</td>
                    <td className="font-medium">{item.name}</td>
                    <td><StatusBadge status={item.status} /></td>
                    <td>
                      <div className="flex flex-column gap-1">
                        <span className="text-xs">CPU: {item.cpu}%</span>
                        <span className="text-xs">MEM: {item.memory}%</span>
                        <span className="text-xs">NET: {item.network}%</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex justify-content-center">
                        {actionButtonTemplate(item.id)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Full table (MD and up breakpoints)
  return (
    <div className="p-datatable p-component overflow-x-auto">
      <div className="p-datatable-wrapper flex justify-content-center">
        <table className="p-datatable-table w-full pt-5">
          <thead className="p-datatable-thead">
            <tr>
              <th style={{ width: '5%' }}>ID</th>
              <th style={{ width: '20%' }}>System Name</th>
              <th style={{ width: '15%' }}>Status</th>
              <th style={{ width: '15%' }}>CPU Usage %</th>
              <th style={{ width: '15%' }}>Memory Usage %</th>
              <th style={{ width: '15%' }}>Network Usage %</th>
              <th style={{ width: '10%' }}>Actions</th>
            </tr>
          </thead>
          <tbody className="p-datatable-tbody">
            {systemData.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center">No system data available</td>
              </tr>
            ) : (
              systemData.map(item => (
                <tr key={item.id} className="p-selectable-row">
                  <td>{item.id}</td>
                  <td className="font-medium">{item.name}</td>
                  <td><StatusBadge status={item.status} /></td>
                  <td>
                    <div className="flex align-items-center">
                      <div className="mr-2">{item.cpu}%</div>
                      {resourceProgressBar(item.cpu, 'bg-blue-500')}
                    </div>
                  </td>
                  <td>
                    <div className="flex align-items-center">
                      <div className="mr-2">{item.memory}%</div>
                      {resourceProgressBar(item.memory, 'bg-purple-500')}
                    </div>
                  </td>
                  <td>
                    <div className="flex align-items-center">
                      <div className="mr-2">{item.network}%</div>
                      {resourceProgressBar(item.network, 'bg-orange-500')}
                    </div>
                  </td>
                  <td>
                    <div className="flex justify-content-center">
                      {actionButtonTemplate(item.id)}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default SystemTable 