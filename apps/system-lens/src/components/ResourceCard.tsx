import React from 'react'

interface ResourceCardProps {
  title: string
  icon: React.ReactElement
  value: string | number
  resourceColor: string
  progressValue: number
  iconColor?: string
}

const ResourceCard: React.FC<ResourceCardProps> = ({
  title,
  icon,
  value,
  resourceColor,
  progressValue,
  iconColor = 'blue-500'
}) => {
  // Progress bar template for resource usage
  const resourceProgressBar = (value: number, color: string) => {
    return (
      <div className="w-full surface-200 border-round overflow-hidden" style={{ height: '0.5rem' }}>
        <div className={color} style={{ width: `${value}%`, height: '100%' }}></div>
      </div>
    )
  }

  return (
    <div className="card border-1 border-50 h-full p-4">
      <div className="flex align-items-center justify-content-between mb-3">
        <div className="flex align-items-center">
          <i className={`${icon.props.className} text-${iconColor} mr-2`} style={{ fontSize: '1.5rem' }}></i>
          <span className="text-xl font-medium">{title}</span>
        </div>
        <span className="text-4xl font-bold">{value}</span>
      </div>
      <div className="mt-4">
        {resourceProgressBar(progressValue, resourceColor)}
      </div>
    </div>
  )
}

export default ResourceCard 