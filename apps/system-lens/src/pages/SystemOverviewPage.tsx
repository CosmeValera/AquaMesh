import React, { useEffect, useRef, useState } from 'react';
import { useSystemLens } from '../provider/SystemLensProvider';
import Chart from 'chart.js/auto';
import { 
  ContainerBreakpointProvider, 
  ContainerVisible, 
  CQ 
} from '../components/ContainerResponsive';

// Define the SystemData interface
interface SystemData {
  id: number;
  name: string;
  status: string;
  cpu: number;
  memory: number;
  network: number;
}

const SystemOverviewPage: React.FC = () => {
  const { systemData, setSystemData, loading, setLoading, error, setError } = useSystemLens();
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);
  const [chartView, setChartView] = useState<'all' | 'cpu' | 'memory' | 'network'>('all');

  useEffect(() => {
    const fetchSystemData = async () => {
      setLoading(true);
      try {
        // Simulating API call with mock data
        setTimeout(() => {
          const mockData = [
            { id: 1, name: 'App Server', status: 'Online', cpu: 12, memory: 42, network: 56 },
            { id: 2, name: 'Database Server', status: 'Online', cpu: 34, memory: 58, network: 23 },
            { id: 3, name: 'Storage Server', status: 'Warning', cpu: 67, memory: 75, network: 45 },
            { id: 4, name: 'Backup Server', status: 'Offline', cpu: 0, memory: 0, network: 0 },
            { id: 5, name: 'Web Server', status: 'Online', cpu: 28, memory: 36, network: 82 },
            { id: 6, name: 'API Gateway', status: 'Online', cpu: 15, memory: 28, network: 62 },
            { id: 7, name: 'Cache Server', status: 'Warning', cpu: 72, memory: 64, network: 31 }
          ];
          setSystemData(mockData);
          setLoading(false);
        }, 1000);
      } catch (err) {
        setError('Failed to fetch system data');
        setLoading(false);
      }
    };

    fetchSystemData();
  }, [setSystemData, setLoading, setError]);

  useEffect(() => {
    if (chartRef.current && systemData.length > 0) {
      // Destroy previous chart if it exists
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      const ctx = chartRef.current.getContext('2d');
      if (!ctx) return;

      // Define datasets based on selected view
      const datasets = [];
      
      if (chartView === 'all' || chartView === 'cpu') {
        datasets.push({
          label: 'CPU Usage %',
          data: systemData.map(item => item.cpu),
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        });
      }
      
      if (chartView === 'all' || chartView === 'memory') {
        datasets.push({
          label: 'Memory Usage %',
          data: systemData.map(item => item.memory),
          backgroundColor: 'rgba(153, 102, 255, 0.2)',
          borderColor: 'rgba(153, 102, 255, 1)',
          borderWidth: 1,
        });
      }
      
      if (chartView === 'all' || chartView === 'network') {
        datasets.push({
          label: 'Network Usage %',
          data: systemData.map(item => item.network),
          backgroundColor: 'rgba(255, 159, 64, 0.2)',
          borderColor: 'rgba(255, 159, 64, 1)',
          borderWidth: 1,
        });
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
      });
    }

    // Cleanup function
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [systemData, chartView]);

  // Template functions for DataTable
  const statusBodyTemplate = (rowData: SystemData) => {
    const severity = rowData.status === 'Online' ? 'success' : 
                    rowData.status === 'Warning' ? 'warning' : 'danger';
    
    return <span className={`p-tag p-tag-${severity}`}>{rowData.status}</span>;
  };

  const actionBodyTemplate = () => {
    return (
      <button className="p-button p-button-rounded p-button-text">
        <i className="pi pi-cog"></i>
      </button>
    );
  };

  // Progress bar template for resource usage
  const resourceProgressBar = (value: number, color: string) => {
    return (
      <div className="w-full surface-200 border-round overflow-hidden" style={{ height: '0.5rem' }}>
        <div className={color} style={{ width: `${value}%`, height: '100%' }}></div>
      </div>
    );
  };

  // Handle chart view change
  const handleChartViewChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setChartView(e.target.value as 'all' | 'cpu' | 'memory' | 'network');
  };

  return (
    <ContainerBreakpointProvider className="p-4 bg-teal-900">
      <div className="flex align-items-center justify-content-between mb-5">
        <h1 className="text-3xl font-bold text-primary m-0">System Overview</h1>
        <div className="flex align-items-center gap-2">
          <button className="p-button p-button-outlined">
            <i className="pi pi-refresh mr-2"></i>
            Refresh
          </button>
          <button className="p-button p-button-primary">
            <i className="pi pi-cog mr-2"></i>
            Settings
          </button>
        </div>
      </div>
      
      <div className="grid">
        {/* Summary Cards */}
        <div className={`${CQ.col12} ${CQ.lg.col4}`}>
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
        </div>

        <div className={`${CQ.col12} ${CQ.lg.col4}`}>
          <div className="card border-1 border-50 h-full p-4">
            <div className="flex align-items-center justify-content-between mb-3">
              <div className="flex align-items-center">
                <i className="pi pi-database text-blue-500 mr-2" style={{ fontSize: '1.5rem' }}></i>
                <span className="text-xl font-medium">CPU Usage</span>
              </div>
              <span className="text-4xl font-bold">{(systemData.reduce((acc, curr) => acc + curr.cpu, 0) / systemData.length || 0).toFixed(1)}%</span>
            </div>
            <div className="mt-4">
              {resourceProgressBar((systemData.reduce((acc, curr) => acc + curr.cpu, 0) / systemData.length || 0), 'bg-blue-500')}
            </div>
          </div>
        </div>

        <div className={`${CQ.col12} ${CQ.lg.col4}`}>
          <div className="card border-1 border-50 h-full p-4">
            <div className="flex align-items-center justify-content-between mb-3">
              <div className="flex align-items-center">
                <i className="pi pi-microchip text-purple-500 mr-2" style={{ fontSize: '1.5rem' }}></i>
                <span className="text-xl font-medium">Memory Usage</span>
              </div>
              <span className="text-4xl font-bold">{(systemData.reduce((acc, curr) => acc + curr.memory, 0) / systemData.length || 0).toFixed(1)}%</span>
            </div>
            <div className="mt-4">
              {resourceProgressBar((systemData.reduce((acc, curr) => acc + curr.memory, 0) / systemData.length || 0), 'bg-purple-500')}
            </div>
          </div>
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
                </div>
              ) : (
                <>
                  {/* Mobile Card View (for xs containers) */}
                  <ContainerVisible breakpoint="xs" condition="only">
                    <div className="p-3">
                      {systemData.map(item => (
                        <div key={item.id} className="card mb-3 p-3 border-1 border-50 bg-teal-900">
                          <div className="flex justify-content-between align-items-center mb-3">
                            <span className="font-medium text-lg">{item.name}</span>
                            {statusBodyTemplate(item)}
                          </div>
                          <div className="grid">
                            <div className="col-6 mb-2">
                              <div className="text-sm text-500">CPU</div>
                              <div className="flex align-items-center mt-1">
                                <span className="mr-2">{item.cpu}%</span>
                                {resourceProgressBar(item.cpu, 'bg-blue-500')}
                              </div>
                            </div>
                            <div className="col-6 mb-2">
                              <div className="text-sm text-500">Memory</div>
                              <div className="flex align-items-center mt-1">
                                <span className="mr-2">{item.memory}%</span>
                                {resourceProgressBar(item.memory, 'bg-purple-500')}
                              </div>
                            </div>
                            <div className="col-12 mb-2">
                              <div className="text-sm text-500">Network</div>
                              <div className="flex align-items-center mt-1">
                                <span className="mr-2">{item.network}%</span>
                                {resourceProgressBar(item.network, 'bg-orange-500')}
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-content-end mt-2">
                            {actionBodyTemplate()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ContainerVisible>

                  {/* Small Container View (compact table) */}
                  <ContainerVisible breakpoint="sm" condition="only">
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
                                  <td>{statusBodyTemplate(item)}</td>
                                  <td>
                                    <div className="flex flex-column gap-1">
                                      <span className="text-xs">CPU: {item.cpu}%</span>
                                      <span className="text-xs">MEM: {item.memory}%</span>
                                      <span className="text-xs">NET: {item.network}%</span>
                                    </div>
                                  </td>
                                  <td>
                                    <div className="flex justify-content-center">
                                      {actionBodyTemplate()}
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </ContainerVisible>

                  {/* Medium and up Container View (full table) */}
                  <ContainerVisible breakpoint="md" condition="up">
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
                                <td colSpan={6} className="text-center">No system data available</td>
                              </tr>
                            ) : (
                              systemData.map(item => (
                                <tr key={item.id} className="p-selectable-row">
                                  <td>{item.id}</td>
                                  <td className="font-medium">{item.name}</td>
                                  <td>{statusBodyTemplate(item)}</td>
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
                                      {actionBodyTemplate()}
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </ContainerVisible>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className={`${CQ.col12} mt-4`}>
          <div className="card p-4">
            <div className="card-header">
              <h3 className="text-xl font-medium m-0">System Resource Usage</h3>
            </div>
            <div className="card-body">
              <div className="chart-container" style={{ position: 'relative', height: '400px', width: '100%', maxHeight: '60vh' }}>
                <canvas ref={chartRef}></canvas>
              </div>
              
              {/* Selector for Chart Focus - Only visible on small containers */}
              <ContainerVisible breakpoint="lg" condition="down">
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
              </ContainerVisible>
            </div>
          </div>
        </div>
      </div>
    </ContainerBreakpointProvider>
  );
};

export default SystemOverviewPage; 