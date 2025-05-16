import React, { useEffect, useRef, useState } from 'react'
import Chart from 'chart.js/auto'
import { SystemData } from '../types/systemTypes'

interface SystemResourceChartProps {
  systemData: SystemData[]
}

const SystemResourceChart: React.FC<SystemResourceChartProps> = ({ systemData }) => {
  const chartRef = useRef<HTMLCanvasElement | null>(null)
  const chartInstance = useRef<Chart | null>(null)
  const [chartView, setChartView] = useState<'all' | 'cpu' | 'memory' | 'network'>('all')

  useEffect(() => {
    if (chartRef.current && systemData.length > 0) {
      // Destroy previous chart if it exists
      if (chartInstance.current) {
        chartInstance.current.destroy()
      }

      const ctx = chartRef.current.getContext('2d')
      if (!ctx) return

      // Define datasets based on selected view
      const datasets = []
      
      if (chartView === 'all' || chartView === 'cpu') {
        datasets.push({
          label: 'CPU Usage %',
          data: systemData.map(item => item.cpu),
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        })
      }
      
      if (chartView === 'all' || chartView === 'memory') {
        datasets.push({
          label: 'Memory Usage %',
          data: systemData.map(item => item.memory),
          backgroundColor: 'rgba(153, 102, 255, 0.2)',
          borderColor: 'rgba(153, 102, 255, 1)',
          borderWidth: 1,
        })
      }
      
      if (chartView === 'all' || chartView === 'network') {
        datasets.push({
          label: 'Network Usage %',
          data: systemData.map(item => item.network),
          backgroundColor: 'rgba(255, 159, 64, 0.2)',
          borderColor: 'rgba(255, 159, 64, 1)',
          borderWidth: 1,
        })
      }

      chartInstance.current = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: systemData.map(item => item.name),
          datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                boxWidth: 12,
                font: {
                  size: 11
                }
              }
            },
            tooltip: {
              mode: 'index',
              intersect: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: {
                font: {
                  size: 10
                }
              }
            },
            x: {
              ticks: {
                font: {
                  size: 10
                },
                maxRotation: 45,
                minRotation: 45
              }
            }
          }
        }
      })
    }

    // Cleanup function
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy()
      }
    }
  }, [systemData, chartView])

  // Handle chart view change
  const handleChartViewChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setChartView(e.target.value as 'all' | 'cpu' | 'memory' | 'network')
  }

  return (
    <div className="card p-4">
      <div className="card-header">
        <h3 className="text-xl font-medium m-0">System Resource Usage</h3>
      </div>
      <div className="card-body">
        <div className="chart-container" style={{ position: 'relative', height: '400px', width: '100%', maxHeight: '60dvh' }}>
          <canvas ref={chartRef}></canvas>
        </div>
        
        {/* Selector for Chart Focus - you can determine when to show this based on props */}
        <div className="mt-4">
          <select 
            className="p-inputtext w-full" 
            value={chartView}
            onChange={handleChartViewChange}
          >
            <option value="all">All Resources</option>
            <option value="cpu">CPU Usage Only</option>
            <option value="memory">Memory Usage Only</option>
            <option value="network">Network Usage Only</option>
          </select>
        </div>
      </div>
    </div>
  )
}

export default SystemResourceChart 