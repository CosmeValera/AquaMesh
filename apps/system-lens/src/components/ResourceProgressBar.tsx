import React from 'react'

interface ResourceProgressBarProps {
  value: number
  colorClass: string
  showValue?: boolean
}

const ResourceProgressBar: React.FC<ResourceProgressBarProps> = ({ 
  value, 
  colorClass,
  showValue = false 
}) => {
  return (
    <div className="flex align-items-center w-full">
      {showValue && <div className="mr-2">{value}%</div>}
      <div className="w-full surface-200 border-round overflow-hidden" style={{ height: '0.5rem' }}>
        <div className={colorClass} style={{ width: `${value}%`, height: '100%' }}></div>
      </div>
    </div>
  )
}

export default ResourceProgressBar 