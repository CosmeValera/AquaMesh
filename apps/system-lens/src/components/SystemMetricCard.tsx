import React from 'react';

interface SystemMetricCardProps {
  title: string;
  value: number;
  icon: string;
  color: string;
  description: string;
}

const SystemMetricCard: React.FC<SystemMetricCardProps> = ({
  title,
  value,
  icon,
  color,
  description
}) => {
  // Determine severity color based on value
  const getSeverity = (val: number) => {
    if (val < 50) return 'success';
    if (val < 75) return 'warning';
    return 'danger';
  };

  const severity = getSeverity(value);

  return (
    <div className="p-card h-100">
      <div className="p-card-body">
        <div className="flex flex-column">
          <div className="flex align-items-center justify-content-between mb-3">
            <span className="text-xl font-medium">{title}</span>
            <i className={`${icon} text-xl`} style={{ color }}></i>
          </div>
          
          <div className="flex flex-column gap-2">
            <div className="flex justify-content-between">
              <span className="font-medium">Current Usage</span>
              <span className={`font-bold text-${severity}`}>{value}%</span>
            </div>
            
            <div className="progress-container" style={{ height: '0.5rem', backgroundColor: `var(--${severity}-100)` }}>
              <div 
                className="progress-value" 
                style={{ 
                  width: `${value}%`, 
                  backgroundColor: `var(--${severity}-500)`,
                  height: '100%'
                }} 
              />
            </div>
            
            <small className="text-color-secondary">{description}</small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemMetricCard; 