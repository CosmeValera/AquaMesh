import React from 'react'

interface StatusBadgeProps {
  status: string
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const severity = status === 'Online' ? 'success' : 
                  status === 'Warning' ? 'warning' : 'danger'
  
  return <span className={`p-tag p-tag-${severity}`}>{status}</span>
}

export default StatusBadge 