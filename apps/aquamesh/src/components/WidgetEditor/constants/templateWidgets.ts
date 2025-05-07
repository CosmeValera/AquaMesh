import { CustomWidget } from '../WidgetStorage';

// Templates for common widget types
export const WIDGET_TEMPLATES: CustomWidget[] = [
  {
    id: 'template-basic-form',
    name: 'Basic Form Template',
    components: [
      {
        id: 'template-fieldset-1',
        type: 'FieldSet',
        props: {
          legend: 'User Information',
          collapsed: false,
          borderStyle: 'solid',
          useCustomColor: true,
          borderColor: '#4a90e2',
          legendColor: '#4a90e2',
          legendBold: true
        },
        children: [
          {
            id: 'template-text-1',
            type: 'TextField',
            props: {
              label: 'Full Name',
              placeholder: 'Enter your full name',
              defaultValue: '',
              required: true,
              fullWidth: true
            }
          },
          {
            id: 'template-text-2',
            type: 'TextField',
            props: {
              label: 'Email Address',
              placeholder: 'Enter your email',
              defaultValue: '',
              required: true,
              fullWidth: true
            }
          },
          {
            id: 'template-switch-1',
            type: 'SwitchEnable',
            props: {
              label: 'Subscribe to newsletter',
              defaultChecked: true,
              labelPlacement: 'end'
            }
          }
        ]
      },
      {
        id: 'template-button-1',
        type: 'Button',
        props: {
          text: 'Submit',
          variant: 'contained',
          showToast: true,
          toastMessage: 'Form submitted successfully!',
          toastSeverity: 'success'
        }
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'template-dashboard',
    name: 'Dashboard Stats Template',
    components: [
      {
        id: 'template-flex-1',
        type: 'FlexBox',
        props: {
          direction: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          spacing: 2,
          wrap: 'wrap'
        },
        children: [
          {
            id: 'template-fieldset-stat1',
            type: 'FieldSet',
            props: {
              legend: 'Total Users',
              borderStyle: 'solid',
              useCustomColor: true,
              borderColor: '#4caf50',
              backgroundColor: 'rgba(76, 175, 80, 0.1)',
              legendColor: '#4caf50',
              legendBold: true,
              padding: 1
            },
            children: [
              {
                id: 'template-label-stat1',
                type: 'Label',
                props: {
                  text: '1,254',
                  variant: 'h3',
                  align: 'center',
                  useCustomColor: true,
                  customColor: '#4caf50'
                }
              }
            ]
          },
          {
            id: 'template-fieldset-stat2',
            type: 'FieldSet',
            props: {
              legend: 'Active Sessions',
              borderStyle: 'solid',
              useCustomColor: true,
              borderColor: '#f57c00',
              backgroundColor: 'rgba(245, 124, 0, 0.1)',
              legendColor: '#f57c00',
              legendBold: true,
              padding: 1
            },
            children: [
              {
                id: 'template-label-stat2',
                type: 'Label',
                props: {
                  text: '423',
                  variant: 'h3',
                  align: 'center',
                  useCustomColor: true,
                  customColor: '#f57c00'
                }
              }
            ]
          },
          {
            id: 'template-fieldset-stat3',
            type: 'FieldSet',
            props: {
              legend: 'System Status',
              borderStyle: 'solid',
              useCustomColor: true,
              borderColor: '#2196f3',
              backgroundColor: 'rgba(33, 150, 243, 0.1)',
              legendColor: '#2196f3',
              legendBold: true,
              padding: 1
            },
            children: [
              {
                id: 'template-label-stat3',
                type: 'Label',
                props: {
                  text: 'Online',
                  variant: 'h3',
                  align: 'center',
                  useCustomColor: true,
                  customColor: '#2196f3'
                }
              }
            ]
          }
        ]
      },
      {
        id: 'template-chart-1',
        type: 'Chart',
        props: {
          title: 'Monthly Usage',
          chartType: 'pie',
          height: 300,
          description: 'System resources usage by month',
          data: `{
            "labels": ["CPU", "Memory", "Storage", "Network", "GPU"],
            "datasets": [
              {
                "data": [35, 25, 15, 15, 10],
                "backgroundColor": [
                  "rgba(75, 192, 192, 0.8)",
                  "rgba(54, 162, 235, 0.8)",
                  "rgba(255, 99, 132, 0.8)",
                  "rgba(255, 206, 86, 0.8)",
                  "rgba(153, 102, 255, 0.8)"
                ]
              }
            ]
          }`
        }
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'template-report',
    name: 'Status Report Template',
    components: [
      {
        id: 'template-title',
        type: 'Label',
        props: {
          text: 'System Status Report',
          variant: 'h4',
          align: 'center',
          useCustomColor: true,
          customColor: '#3f51b5',
          gutterBottom: true
        }
      },
      {
        id: 'template-grid-1',
        type: 'GridBox',
        props: {
          columns: 2,
          spacing: 2
        },
        children: [
          {
            id: 'template-fieldset-report1',
            type: 'FieldSet',
            props: {
              legend: 'System Health',
              borderStyle: 'solid',
              collapsed: false
            },
            children: [
              {
                id: 'template-switch-system',
                type: 'SwitchEnable',
                props: {
                  label: 'System Online',
                  defaultChecked: true,
                  disabled: true
                }
              },
              {
                id: 'template-switch-backups',
                type: 'SwitchEnable',
                props: {
                  label: 'Backups Active',
                  defaultChecked: true,
                  disabled: true
                }
              },
              {
                id: 'template-switch-alerts',
                type: 'SwitchEnable',
                props: {
                  label: 'Alerts Enabled',
                  defaultChecked: true,
                  disabled: false,
                  showToast: true,
                  onMessage: 'Alerts enabled',
                  offMessage: 'Alerts disabled',
                  toastSeverity: 'info'
                }
              }
            ]
          },
          {
            id: 'template-fieldset-report2',
            type: 'FieldSet',
            props: {
              legend: 'Key Metrics',
              borderStyle: 'solid',
              collapsed: false
            },
            children: [
              {
                id: 'template-text-uptime',
                type: 'TextField',
                props: {
                  label: 'System Uptime',
                  defaultValue: '14 days, 6 hours',
                  disabled: true,
                  fullWidth: true
                }
              },
              {
                id: 'template-text-lastbackup',
                type: 'TextField',
                props: {
                  label: 'Last Backup',
                  defaultValue: '2023-05-15 04:30 UTC',
                  disabled: true,
                  fullWidth: true
                }
              }
            ]
          }
        ]
      },
      {
        id: 'template-actions',
        type: 'FlexBox',
        props: {
          direction: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          spacing: 1,
          wrap: 'wrap'
        },
        children: [
          {
            id: 'template-button-refresh',
            type: 'Button',
            props: {
              text: 'Refresh Data',
              variant: 'outlined',
              icon: 'refresh',
              showToast: true,
              toastMessage: 'Data refreshed',
              toastSeverity: 'info'
            }
          },
          {
            id: 'template-button-export',
            type: 'Button',
            props: {
              text: 'Export Report',
              variant: 'contained',
              icon: 'save',
              showToast: true,
              toastMessage: 'Report exported successfully',
              toastSeverity: 'success'
            }
          }
        ]
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Function to clone a template and generate new IDs
export const cloneTemplate = (templateId: string): CustomWidget | null => {
  const template = WIDGET_TEMPLATES.find(t => t.id === templateId);
  if (!template) return null;
  
  // Generate a new ID for the widget
  const newWidget: CustomWidget = {
    ...JSON.parse(JSON.stringify(template)),
    id: `widget-${Date.now()}`,
    name: `${template.name.replace(' Template', '')}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // Generate new IDs for all components recursively
  const regenerateIds = (components: any[]): any[] => {
    return components.map(component => {
      const newComponent = {
        ...component,
        id: `component-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      };
      
      if (newComponent.children && Array.isArray(newComponent.children)) {
        newComponent.children = regenerateIds(newComponent.children);
      }
      
      return newComponent;
    });
  };
  
  newWidget.components = regenerateIds(newWidget.components);
  return newWidget;
}; 