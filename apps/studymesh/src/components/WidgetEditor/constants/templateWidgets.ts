import { CustomWidget } from '../WidgetStorage'

// Templates for common widget types
export const WIDGET_TEMPLATES: CustomWidget[] = [
  {
    id: 'template-basic-form',
    name: 'Basic Form Template',
    description:
      'A clean, user-friendly form with styled fieldset, input fields, and submit button perfect for collecting information.',
    components: [
      {
        id: 'template-fieldset-1',
        type: 'FieldSet',
        props: {
          legend: 'User Information',
          collapsed: false,
          borderStyle: 'solid',
          useCustomColor: true,
          borderColor: '#2c7be5',
          backgroundColor: 'rgba(44, 123, 229, 0.04)',
          legendColor: '#2c7be5',
          legendBold: true,
          padding: 2,
          borderRadius: 8,
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
              fullWidth: true,
              variant: 'outlined',
              margin: 'normal',
              helperText: 'Your first and last name',
            },
          },
          {
            id: 'template-text-2',
            type: 'TextField',
            props: {
              label: 'Email Address',
              placeholder: 'Enter your email',
              defaultValue: '',
              required: true,
              fullWidth: true,
              variant: 'outlined',
              margin: 'normal',
              helperText: "We'll never share your email",
            },
          },
          {
            id: 'template-switch-1',
            type: 'SwitchEnable',
            props: {
              label: 'Subscribe to newsletter',
              defaultChecked: true,
              labelPlacement: 'end',
              margin: 'normal',
              color: 'primary',
            },
          },
        ],
      },
      {
        id: 'template-button-1',
        type: 'Button',
        props: {
          text: 'Submit',
          variant: 'contained',
          color: 'primary',
          size: 'large',
          fullWidth: false,

          sx: {
            marginTop: 3,
            borderRadius: 2,
            fontWeight: 'bold',
            boxShadow: 3,
            padding: '10px 24px',
          },
        },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['form', 'input', 'user data'],
  },
  {
    id: 'template-dashboard',
    name: 'Dashboard Stats Template',
    description:
      'A modern dashboard layout featuring key performance metrics in visually distinct panels with a color-coded chart for data visualization.',
    components: [
      {
        id: 'template-flex-1',
        type: 'FlexBox',
        props: {
          direction: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          spacing: 2,
          wrap: 'wrap',
          sx: {
            marginBottom: 3,
          },
        },
        children: [
          {
            id: 'template-fieldset-stat1',
            type: 'FieldSet',
            props: {
              legend: 'Total Users',
              borderStyle: 'solid',
              useCustomColor: true,
              borderColor: '#3bc179',
              backgroundColor: 'rgba(59, 193, 121, 0.08)',
              legendColor: '#3bc179',
              legendBold: true,
              padding: 1.5,
              borderRadius: 8,
              borderWidth: 1.5,
              boxShadow: '0 4px 12px rgba(59, 193, 121, 0.15)',
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
                  customColor: '#3bc179',
                  fontWeight: 'bold',
                  sx: {
                    textShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    letterSpacing: '-0.5px',
                  },
                },
              },
            ],
          },
          {
            id: 'template-fieldset-stat2',
            type: 'FieldSet',
            props: {
              legend: 'Active Sessions',
              borderStyle: 'solid',
              useCustomColor: true,
              borderColor: '#e67c13',
              backgroundColor: 'rgba(230, 124, 19, 0.08)',
              legendColor: '#e67c13',
              legendBold: true,
              padding: 1.5,
              borderRadius: 8,
              borderWidth: 1.5,
              boxShadow: '0 4px 12px rgba(230, 124, 19, 0.15)',
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
                  customColor: '#e67c13',
                  fontWeight: 'bold',
                  sx: {
                    textShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    letterSpacing: '-0.5px',
                  },
                },
              },
            ],
          },
          {
            id: 'template-fieldset-stat3',
            type: 'FieldSet',
            props: {
              legend: 'System Status',
              borderStyle: 'solid',
              useCustomColor: true,
              borderColor: '#0c87f2',
              backgroundColor: 'rgba(12, 135, 242, 0.08)',
              legendColor: '#0c87f2',
              legendBold: true,
              padding: 1.5,
              borderRadius: 8,
              borderWidth: 1.5,
              boxShadow: '0 4px 12px rgba(12, 135, 242, 0.15)',
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
                  customColor: '#0c87f2',
                  fontWeight: 'bold',
                  sx: {
                    textShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    letterSpacing: '-0.5px',
                  },
                },
              },
            ],
          },
        ],
      },
      {
        id: 'template-chart-1',
        type: 'Chart',
        props: {
          title: 'Monthly Usage',
          chartType: 'pie',
          height: 320,
          description: 'System resources usage by month',
          sx: {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            padding: 2,
            borderRadius: 3,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          },
          data: `{
            "labels": ["CPU", "Memory", "Storage", "Network", "GPU"],
            "datasets": [
              {
                "data": [35, 25, 15, 15, 10],
                "backgroundColor": [
                  "rgba(75, 192, 192, 0.85)",
                  "rgba(54, 162, 235, 0.85)",
                  "rgba(255, 99, 132, 0.85)",
                  "rgba(255, 206, 86, 0.85)",
                  "rgba(153, 102, 255, 0.85)"
                ],
                "borderColor": [
                  "rgba(75, 192, 192, 1)",
                  "rgba(54, 162, 235, 1)",
                  "rgba(255, 99, 132, 1)",
                  "rgba(255, 206, 86, 1)",
                  "rgba(153, 102, 255, 1)"
                ],
                "borderWidth": 2
              }
            ]
          }`,
        },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['dashboard', 'stats', 'chart', 'metrics'],
  },
  {
    id: 'template-operations-dashboard',
    name: 'Daily Operations Example Template',
    description:
      'One concrete starter example for tracking orders, delayed tasks, support tickets, system status, team notes, and handoff actions. Use it as inspiration, then adapt StudyMesh to your own domain.',
    category: 'Dashboard',
    components: [
      {
        id: 'template-ops-title',
        type: 'Label',
        props: {
          text: 'Daily Operations Dashboard',
          variant: 'h4',
          gutterBottom: true,
          useCustomColor: true,
          customColor: '#174A5C',
          fontWeight: 700,
          styleJson: '{"marginBottom":"16px"}',
        },
      },
      {
        id: 'template-ops-status-grid',
        type: 'GridBox',
        props: {
          columns: 3,
          spacing: 2,
          responsive: true,
          sx: {
            marginBottom: 2,
          },
        },
        children: [
          {
            id: 'template-ops-status-card',
            type: 'FieldSet',
            props: {
              legend: 'Orders Today',
              collapsed: false,
              borderStyle: 'solid',
              useCustomBorderColor: true,
              useCustomLegendColor: true,
              borderColor: '#1E88E5',
              legendColor: '#1E88E5',
              padding: 2,
              borderRadius: 8,
            },
            children: [
              {
                id: 'template-ops-status-value',
                type: 'Label',
                props: {
                  text: '128',
                  variant: 'h5',
                  textAlign: 'center',
                  useCustomColor: true,
                  customColor: '#1E88E5',
                  fontWeight: 700,
                },
              },
              {
                id: 'template-ops-status-caption',
                type: 'Label',
                props: {
                  text: '18 still waiting for dispatch',
                  variant: 'body2',
                  useCustomColor: true,
                  customColor: '#455A64',
                },
              },
            ],
          },
          {
            id: 'template-ops-incidents-card',
            type: 'FieldSet',
            props: {
              legend: 'Delayed Tasks',
              collapsed: false,
              borderStyle: 'solid',
              useCustomBorderColor: true,
              useCustomLegendColor: true,
              borderColor: '#E67E22',
              legendColor: '#E67E22',
              padding: 2,
              borderRadius: 8,
            },
            children: [
              {
                id: 'template-ops-incidents-value',
                type: 'Label',
                props: {
                  text: '7',
                  variant: 'h5',
                  textAlign: 'center',
                  useCustomColor: true,
                  customColor: '#E67E22',
                  fontWeight: 700,
                },
              },
              {
                id: 'template-ops-incidents-caption',
                type: 'Label',
                props: {
                  text: '3 need owner follow-up',
                  variant: 'body2',
                  useCustomColor: true,
                  customColor: '#455A64',
                },
              },
            ],
          },
          {
            id: 'template-ops-queue-card',
            type: 'FieldSet',
            props: {
              legend: 'Open Tickets',
              collapsed: false,
              borderStyle: 'solid',
              useCustomBorderColor: true,
              useCustomLegendColor: true,
              borderColor: '#2E7D32',
              legendColor: '#2E7D32',
              padding: 2,
              borderRadius: 8,
            },
            children: [
              {
                id: 'template-ops-queue-value',
                type: 'Label',
                props: {
                  text: '23',
                  variant: 'h5',
                  textAlign: 'center',
                  useCustomColor: true,
                  customColor: '#2E7D32',
                  fontWeight: 700,
                },
              },
              {
                id: 'template-ops-queue-caption',
                type: 'Label',
                props: {
                  text: '5 waiting more than 24 hours',
                  variant: 'body2',
                  useCustomColor: true,
                  customColor: '#455A64',
                },
              },
            ],
          },
        ],
      },
      {
        id: 'template-ops-content-grid',
        type: 'GridBox',
        props: {
          columns: 2,
          spacing: 3,
          responsive: true,
        },
        children: [
          {
            id: 'template-ops-chart',
            type: 'Chart',
            props: {
              title: 'Support Ticket Mix',
              chartType: 'pie',
              description: 'Current support ticket categories',
              data: `{
                "labels": ["Shipping", "Payments", "Returns", "Account Help"],
                "datasets": [
                  {
                    "label": "Tickets",
                    "data": [34, 28, 18, 20],
                    "backgroundColor": [
                      "rgba(229, 57, 53, 0.85)",
                      "rgba(30, 136, 229, 0.85)",
                      "rgba(251, 192, 45, 0.85)",
                      "rgba(67, 160, 71, 0.85)"
                    ]
                  }
                ]
              }`,
            },
          },
          {
            id: 'template-ops-controls',
            type: 'FieldSet',
            props: {
              legend: 'Team Handoff',
              collapsed: false,
              borderStyle: 'solid',
              useCustomBorderColor: true,
              useCustomLegendColor: true,
              borderColor: '#546E7A',
              legendColor: '#546E7A',
              padding: 2,
              borderRadius: 8,
            },
            children: [
              {
                id: 'template-ops-maintenance-switch',
                type: 'SwitchEnable',
                props: {
                  label: 'System status healthy',
                  defaultChecked: true,
                  labelPlacement: 'end',
                  color: 'success',
                },
              },
              {
                id: 'template-ops-note',
                type: 'TextField',
                props: {
                  label: "Today's focus",
                  placeholder: 'Add handoff note for the next shift',
                  defaultValue:
                    'Clear delayed shipments before 16:00 and follow up on payment tickets.',
                  fullWidth: true,
                  multiline: true,
                  rows: 3,
                  variant: 'outlined',
                  margin: 'normal',
                },
              },
              {
                id: 'template-ops-notify-button',
                type: 'Button',
                props: {
                  text: 'Send Handoff',
                  variant: 'contained',
                  color: 'primary',
                  size: 'medium',
                  showStartIcon: true,
                  iconName: 'notification',
                  clickAction: 'none',

                  borderRadius: 6,
                  fontWeight: 700,
                },
              },
            ],
          },
        ],
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['dashboard', 'daily operations', 'orders', 'tickets', 'handoff'],
  },
  {
    id: 'template-report',
    name: 'Status Report Template',
    description:
      'A comprehensive status report interface with system health indicators, key metrics display, and action buttons for data management.',
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
          gutterBottom: true,
          fontWeight: 'bold',
          sx: {
            marginBottom: 3,
            paddingBottom: 2,
            borderBottom: '1px solid rgba(63, 81, 181, 0.2)',
            textShadow: '0 1px 2px rgba(0,0,0,0.05)',
          },
        },
      },
      {
        id: 'template-grid-1',
        type: 'GridBox',
        props: {
          columns: 2,
          spacing: 3,
          sx: {
            marginBottom: 3,
          },
        },
        children: [
          {
            id: 'template-fieldset-report1',
            type: 'FieldSet',
            props: {
              legend: 'System Health',
              borderStyle: 'solid',
              collapsed: false,
              borderColor: '#5c6bc0',
              backgroundColor: 'rgba(92, 107, 192, 0.05)',
              padding: 2,
              borderRadius: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            },
            children: [
              {
                id: 'template-switch-system',
                type: 'SwitchEnable',
                props: {
                  label: 'System Online',
                  defaultChecked: true,
                  disabled: true,
                  color: 'success',
                  sx: { marginY: 1 },
                },
              },
              {
                id: 'template-switch-backups',
                type: 'SwitchEnable',
                props: {
                  label: 'Backups Active',
                  defaultChecked: true,
                  disabled: true,
                  color: 'success',
                  sx: { marginY: 1 },
                },
              },
              {
                id: 'template-switch-alerts',
                type: 'SwitchEnable',
                props: {
                  label: 'Alerts Enabled',
                  defaultChecked: true,
                  disabled: false,
                  color: 'primary',

                  sx: { marginY: 1 },
                },
              },
            ],
          },
          {
            id: 'template-fieldset-report2',
            type: 'FieldSet',
            props: {
              legend: 'Key Metrics',
              borderStyle: 'solid',
              collapsed: false,
              borderColor: '#26a69a',
              backgroundColor: 'rgba(38, 166, 154, 0.05)',
              padding: 2,
              borderRadius: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            },
            children: [
              {
                id: 'template-text-uptime',
                type: 'TextField',
                props: {
                  label: 'System Uptime',
                  defaultValue: '14 days, 6 hours',
                  disabled: true,
                  fullWidth: true,
                  variant: 'outlined',
                  margin: 'normal',
                  InputProps: {
                    sx: {
                      backgroundColor: 'rgba(0,0,0,0.03)',
                    },
                  },
                },
              },
              {
                id: 'template-text-lastbackup',
                type: 'TextField',
                props: {
                  label: 'Last Backup',
                  defaultValue: '2023-05-15 04:30 UTC',
                  disabled: true,
                  fullWidth: true,
                  variant: 'outlined',
                  margin: 'normal',
                  InputProps: {
                    sx: {
                      backgroundColor: 'rgba(0,0,0,0.03)',
                    },
                  },
                },
              },
            ],
          },
        ],
      },
      {
        id: 'template-actions',
        type: 'FlexBox',
        props: {
          direction: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          spacing: 2,
          wrap: 'wrap',
          sx: {
            marginTop: 2,
            paddingTop: 2,
            borderTop: '1px solid rgba(0,0,0,0.08)',
          },
        },
        children: [
          {
            id: 'template-button-refresh',
            type: 'Button',
            props: {
              text: 'Refresh Data',
              variant: 'outlined',
              icon: 'refresh',
              color: 'info',

              sx: {
                borderRadius: 2,
                fontWeight: 'medium',
                textTransform: 'none',
              },
            },
          },
          {
            id: 'template-button-export',
            type: 'Button',
            props: {
              text: 'Export Report',
              variant: 'contained',
              icon: 'save',
              color: 'primary',

              sx: {
                borderRadius: 2,
                fontWeight: 'bold',
                textTransform: 'none',
                boxShadow: 2,
              },
            },
          },
        ],
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['report', 'status', 'system', 'monitoring'],
  },
  {
    id: 'template-knowledge-math',
    name: 'Mathematics Knowledge Wiki Template',
    description:
      'A visual study page for formulas, worked examples, practice progress, and questions to review later.',
    category: 'Knowledge Workspace',
    components: [
      {
        id: 'template-math-title',
        type: 'Label',
        props: {
          text: 'Mathematics 1 - Derivatives',
          variant: 'h4',
          gutterBottom: true,
          useCustomColor: true,
          customColor: '#1976D2',
          fontWeight: 700,
        },
      },
      {
        id: 'template-math-overview',
        type: 'FieldSet',
        props: {
          legend: 'What this dashboard teaches',
          collapsed: false,
          borderStyle: 'solid',
          useCustomBorderColor: true,
          useCustomLegendColor: true,
          borderColor: '#1976D2',
          legendColor: '#1976D2',
          backgroundColor: 'rgba(25, 118, 210, 0.08)',
          padding: 2,
          borderRadius: 8,
        },
        children: [
          {
            id: 'template-math-goal',
            type: 'Label',
            props: {
              text: 'Use this as a wiki page: collect the concept, formulas, examples, practice questions, and a progress chart in one reusable dashboard.',
              variant: 'body1',
            },
          },
        ],
      },
      {
        id: 'template-math-grid',
        type: 'GridBox',
        props: { columns: 2, spacing: 2, responsive: true },
        children: [
          {
            id: 'template-math-formulas',
            type: 'FieldSet',
            props: {
              legend: 'Core formulas',
              borderStyle: 'solid',
              useCustomBorderColor: true,
              useCustomLegendColor: true,
              borderColor: '#7B1FA2',
              legendColor: '#7B1FA2',
              padding: 2,
              borderRadius: 8,
            },
            children: [
              {
                id: 'template-math-formula-label',
                type: 'Label',
                props: {
                  text: 'Power rule: d/dx x^n = n*x^(n-1)\nChain rule: d/dx f(g(x)) = f prime(g(x))*g prime(x)\nProduct rule: (fg) prime = f prime*g + f*g prime',
                  variant: 'body1',
                  whiteSpace: 'pre-line',
                },
              },
            ],
          },
          {
            id: 'template-math-questions',
            type: 'FieldSet',
            props: {
              legend: 'Questions to resolve',
              borderStyle: 'solid',
              useCustomBorderColor: true,
              useCustomLegendColor: true,
              borderColor: '#EF6C00',
              legendColor: '#EF6C00',
              padding: 2,
              borderRadius: 8,
            },
            children: [
              {
                id: 'template-math-question-input',
                type: 'TextField',
                props: {
                  label: 'Add a doubt or exam question',
                  placeholder: 'Example: when should I use chain rule?',
                  fullWidth: true,
                  variant: 'outlined',
                  helperText:
                    'Use this block for questions, doubts, or short study notes.',
                },
              },
            ],
          },
        ],
      },
      {
        id: 'template-math-progress',
        type: 'Chart',
        props: {
          title: 'Study progress',
          chartType: 'pie',
          height: 260,
          description: 'Example of using charts as visual study feedback.',
          data: `{
            "labels": ["Understood", "Needs practice", "Ask teacher"],
            "datasets": [{
              "data": [55, 35, 10],
              "backgroundColor": ["rgba(25, 118, 210, 0.85)", "rgba(239, 108, 0, 0.85)", "rgba(194, 24, 91, 0.85)"],
              "borderWidth": 2
            }]
          }`,
        },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['knowledge wiki', 'math', 'study', 'formulas', 'chart'],
  },
  {
    id: 'template-knowledge-physics',
    name: 'Physics Knowledge Wiki Template',
    description:
      'A visual physics study page for formulas, experiment notes, diagrams, and revision status.',
    category: 'Knowledge Workspace',
    components: [
      {
        id: 'template-physics-title',
        type: 'Label',
        props: {
          text: 'Physics 1 — Motion',
          variant: 'h4',
          gutterBottom: true,
          useCustomColor: true,
          customColor: '#007C66',
          fontWeight: 700,
        },
      },
      {
        id: 'template-physics-overview',
        type: 'FieldSet',
        props: {
          legend: 'Knowledge page structure',
          collapsed: false,
          borderStyle: 'solid',
          useCustomBorderColor: true,
          useCustomLegendColor: true,
          borderColor: '#007C66',
          legendColor: '#007C66',
          backgroundColor: 'rgba(0, 124, 102, 0.08)',
          padding: 2,
          borderRadius: 8,
        },
        children: [
          {
            id: 'template-physics-overview-label',
            type: 'Label',
            props: {
              text: 'This example shows how StudyMesh can behave like a visual wiki: formulas, notes, questions, and charts live in the same dashboard.',
              variant: 'body1',
            },
          },
        ],
      },
      {
        id: 'template-physics-grid',
        type: 'GridBox',
        props: { columns: 2, spacing: 2, responsive: true },
        children: [
          {
            id: 'template-physics-formulas',
            type: 'FieldSet',
            props: {
              legend: 'Motion formulas',
              borderStyle: 'solid',
              useCustomBorderColor: true,
              useCustomLegendColor: true,
              borderColor: '#455A64',
              legendColor: '#455A64',
              padding: 2,
              borderRadius: 8,
            },
            children: [
              {
                id: 'template-physics-formula-label',
                type: 'Label',
                props: {
                  text: 'Velocity: v = Δx / Δt\nAcceleration: a = Δv / Δt\nPosition: x = x₀ + vt + ½at²',
                  variant: 'body1',
                  whiteSpace: 'pre-line',
                },
              },
            ],
          },
          {
            id: 'template-physics-lab-notes',
            type: 'FieldSet',
            props: {
              legend: 'Experiment notes',
              borderStyle: 'solid',
              useCustomBorderColor: true,
              useCustomLegendColor: true,
              borderColor: '#C2185B',
              legendColor: '#C2185B',
              padding: 2,
              borderRadius: 8,
            },
            children: [
              {
                id: 'template-physics-note-input',
                type: 'TextField',
                props: {
                  label: 'Observation',
                  placeholder:
                    'Example: slope of position/time graph gives velocity',
                  fullWidth: true,
                  variant: 'outlined',
                  helperText:
                    'Use this block for experiment notes and observations.',
                },
              },
            ],
          },
        ],
      },
      {
        id: 'template-physics-chart',
        type: 'Chart',
        props: {
          title: 'Revision status',
          chartType: 'bar',
          height: 280,
          description: 'Track what needs review before the exam.',
          data: `{
            "labels": ["Formulas", "Graphs", "Problems", "Lab notes"],
            "datasets": [{
              "label": "Confidence",
              "data": [80, 55, 45, 70],
              "backgroundColor": "rgba(0, 124, 102, 0.75)",
              "borderColor": "rgba(0, 124, 102, 1)",
              "borderWidth": 2
            }]
          }`,
        },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['knowledge wiki', 'physics', 'study', 'formulas', 'notes'],
  },

  {
    id: 'template-math-derivatives-chart',
    name: 'Mathematics Derivatives Progress Template',
    description: 'A compact progress widget for tracking derivative confidence.',
    category: 'Knowledge Workspace',
    components: [
      {
        id: 'template-math-chart-hero',
        type: 'LongText',
        props: {
          __blockType: 'LongText',
          title: 'Derivative Progress Tracker',
          text: 'Track confidence by rule. Add your latest confidence score after practice.',
          callout: true,
        },
      },
      {
        id: 'template-math-chart-grid',
        type: 'GridBox',
        props: { columns: 2, spacing: 2, responsive: true },
        children: [
          {
            id: 'template-math-confidence-input-card',
            type: 'FieldSet',
            props: {
              legend: 'Log today’s confidence',
              padding: 2,
              borderRadius: 10,
              borderColor: '#1976D2',
              legendColor: '#1976D2',
              useCustomBorderColor: true,
              useCustomLegendColor: true,
              backgroundColor: 'rgba(25,118,210,0.06)',
            },
            children: [
              {
                id: 'template-math-confidence-input',
                type: 'TextField',
                props: {
                  label: 'Confidence score',
                  placeholder: 'Example: 72',
                  type: 'number',
                  fullWidth: true,
                  helperText: 'Enter a score from 0 to 100.',
                },
              },
              {
                id: 'template-math-confidence-button',
                type: 'Button',
                props: {
                  text: 'Add score to chart',
                  variant: 'contained',
                  color: 'primary',
                  fullWidth: true,
                  clickAction: 'addChartValue',
                  chartLabelSource: 'static',
                  chartLabel: 'Latest score',
                  chartValueSource: 'firstInput',
                },
              },
            ],
          },
          {
            id: 'template-math-progress-chart',
            type: 'Chart',
            props: {
              title: 'Confidence by derivative rule',
              chartType: 'bar',
              height: 280,
              description: 'Use the input to append your latest score.',
              data: `{
                "labels": ["Power", "Chain", "Product", "Word problems"],
                "datasets": [{
                  "label": "Confidence",
                  "data": [85, 55, 65, 35],
                  "backgroundColor": [
                    "rgba(25,118,210,0.75)",
                    "rgba(239,108,0,0.75)",
                    "rgba(123,31,162,0.75)",
                    "rgba(0,124,102,0.75)"
                  ],
                  "borderWidth": 2
                }]
              }`,
            },
          },
        ],
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['mathematics', 'derivatives', 'chart', 'progress'],
  },
  {
    id: 'template-math-derivatives-example',
    name: 'Mathematics Derivatives Example Template',
    description: 'A short worked example with a realistic practice area.',
    category: 'Knowledge Workspace',
    components: [
      {
        id: 'template-math-example-hero',
        type: 'LongText',
        props: {
          __blockType: 'LongText',
          title: 'Derivative Practice Card',
          text: 'Study the example, then solve a similar one. The button records confidence, not correctness.',
          callout: true,
        },
      },
      {
        id: 'template-math-example-grid',
        type: 'GridBox',
        props: { columns: 2, spacing: 2, responsive: true },
        children: [
          {
            id: 'template-math-worked-example',
            type: 'FieldSet',
            props: {
              legend: 'Worked example',
              padding: 2,
              borderRadius: 10,
              borderColor: '#EF6C00',
              legendColor: '#EF6C00',
              useCustomBorderColor: true,
              useCustomLegendColor: true,
              backgroundColor: 'rgba(239,108,0,0.06)',
            },
            children: [
              {
                id: 'template-math-worked-example-text',
                type: 'Label',
                props: {
                  text:
                    'f(x) = 3x⁴ − 2x² + 7\n\nf′(x) = 12x³ − 4x\n\nReason: apply the power rule term by term. The constant becomes 0.',
                  variant: 'body1',
                  whiteSpace: 'pre-line',
                },
              },
            ],
          },
          {
            id: 'template-math-practice-card',
            type: 'FieldSet',
            props: {
              legend: 'Your turn',
              padding: 2,
              borderRadius: 10,
              borderColor: '#1976D2',
              legendColor: '#1976D2',
              useCustomBorderColor: true,
              useCustomLegendColor: true,
              backgroundColor: 'rgba(25,118,210,0.06)',
            },
            children: [
              {
                id: 'template-math-practice-prompt',
                type: 'Label',
                props: {
                  text: 'Find the derivative of y = x³ + 5x² − 8x + 4',
                  variant: 'body1',
                  fontWeight: 700,
                },
              },
              {
                id: 'template-math-example-confidence',
                type: 'TextField',
                props: {
                  label: 'Confidence after solving',
                  placeholder: 'Example: 70',
                  type: 'number',
                  fullWidth: true,
                  margin: 'normal',
                  helperText: 'This value is what the button adds to the chart.',
                },
              },
              {
                id: 'template-math-example-input',
                type: 'TextField',
                props: {
                  label: 'Your derivative',
                  placeholder: 'y′ = ...',
                  fullWidth: true,
                  variant: 'outlined',
                  helperText: 'Write your answer here for review.',
                },
              },
              {
                id: 'template-math-example-button',
                type: 'Button',
                props: {
                  text: 'Add confidence score',
                  variant: 'contained',
                  color: 'primary',
                  fullWidth: true,
                  clickAction: 'addChartValue',
                  chartLabelSource: 'static',
                  chartLabel: 'Practice confidence',
                  chartValueSource: 'firstInput',
                },
              },
            ],
          },
        ],
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['mathematics', 'derivatives', 'example', 'practice'],
  },
  {
    id: 'template-math-derivatives-theory',
    name: 'Mathematics Derivatives Theory Template',
    description: 'A cleaner theory widget with rules, meaning, and review checklist.',
    category: 'Knowledge Workspace',
    components: [
      {
        id: 'template-math-theory-hero',
        type: 'LongText',
        props: {
          __blockType: 'LongText',
          title: 'Derivative Theory Map',
          text: 'A derivative measures instant rate of change: graphically, it is the slope of the tangent line.',
          callout: true,
        },
      },
      {
        id: 'template-math-theory-grid',
        type: 'GridBox',
        props: { columns: 2, spacing: 2, responsive: true },
        children: [
          {
            id: 'template-math-rules-list',
            type: 'ListBlock',
            props: {
              __blockType: 'ListBlock',
              title: 'Core rules',
              items:
                'Power: d/dx xⁿ = n·xⁿ⁻¹\nConstant: d/dx c = 0\nSum: differentiate each term\nProduct: (fg)′ = f′g + fg′\nChain: f(g(x))′ = f′(g(x))·g′(x)',
              ordered: false,
              interactiveChecklist: false,
            },
          },
          {
            id: 'template-math-review-checklist',
            type: 'FieldSet',
            props: {
              legend: 'Review checklist',
              padding: 2,
              borderRadius: 10,
              borderColor: '#7B1FA2',
              legendColor: '#7B1FA2',
              useCustomBorderColor: true,
              useCustomLegendColor: true,
              backgroundColor: 'rgba(123,31,162,0.06)',
            },
            children: [
              {
                id: 'template-math-checklist',
                type: 'ListBlock',
                props: {
                  __blockType: 'ListBlock',
                  title: 'Can I explain this?',
                  items:
                    'What the derivative means\nWhy constants disappear\nWhen to use the chain rule\nWhen to use the product rule',
                  ordered: false,
                  interactiveChecklist: true,
                },
              },
              {
                id: 'template-math-checklist-button',
                type: 'Button',
                props: {
                  text: 'Add completed checklist count',
                  variant: 'outlined',
                  color: 'secondary',
                  fullWidth: true,
                  clickAction: 'addChartValue',
                  chartLabelSource: 'static',
                  chartLabel: 'Theory items mastered',
                  chartValueSource: 'checkedListCount',
                },
              },
            ],
          },
        ],
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['mathematics', 'derivatives', 'theory', 'formulas'],
  },

  {
    id: 'template-aquamesh-interactivity',
    name: 'StudyMesh Interactivity Template',
    description:
      'A hands-on tutorial widget showing buttons, answer boxes, checkable lists, and chart updates.',
    category: 'Knowledge Workspace',
    components: [
      {
        id: 'template-interactivity-title',
        type: 'Label',
        props: {
          text: 'StudyMesh Interactivity',
          variant: 'h4',
          gutterBottom: true,
          useCustomColor: true,
          customColor: '#007C66',
          fontWeight: 700,
        },
      },
      {
        id: 'template-interactivity-intro',
        type: 'LongText',
        props: {
          __blockType: 'LongText',
          title: 'Try the workflow',
          text: 'This dashboard shows the first interactive pattern: type a number, press a button, and watch the chart update. You can also mark checklist items as done and send the completed count into the chart.',
          callout: true,
        },
      },
      {
        id: 'template-interactivity-grid',
        type: 'GridBox',
        props: { columns: 2, spacing: 2, responsive: true },
        children: [
          {
            id: 'template-interactivity-controls',
            type: 'FieldSet',
            props: {
              legend: 'Add typed values to a chart',
              padding: 2,
              borderRadius: 8,
            },
            children: [
              {
                id: 'template-interactivity-input',
                type: 'TextField',
                props: {
                  label: 'Value to add',
                  placeholder: 'Example: 8',
                  type: 'number',
                  fullWidth: true,
                  helperText:
                    'Press the button below to append this number to the chart.',
                },
              },
              {
                id: 'template-interactivity-add-button',
                type: 'Button',
                props: {
                  text: 'Add typed value to chart',
                  variant: 'contained',
                  color: 'primary',
                  clickAction: 'addChartValue',
                  chartLabelSource: 'static',
                  chartLabel: 'Typed value',
                  chartValueSource: 'firstInput',
                },
              },
            ],
          },
          {
            id: 'template-interactivity-tasks',
            type: 'FieldSet',
            props: {
              legend: 'Mark tasks done',
              padding: 2,
              borderRadius: 8,
            },
            children: [
              {
                id: 'template-interactivity-task-list',
                type: 'ListBlock',
                props: {
                  __blockType: 'ListBlock',
                  title: 'Interactive checklist',
                  items:
                    'Read the explanation\nType a chart value\nPress the chart button\nMark this list as done',
                  ordered: false,
                  interactiveChecklist: true,
                },
              },
              {
                id: 'template-interactivity-count-button',
                type: 'Button',
                props: {
                  text: 'Add completed task count',
                  variant: 'outlined',
                  color: 'success',
                  clickAction: 'addChartValue',
                  chartLabelSource: 'static',
                  chartLabel: 'Completed tasks',
                  chartValueSource: 'checkedListCount',
                },
              },
            ],
          },
        ],
      },
      {
        id: 'template-interactivity-chart',
        type: 'Chart',
        props: {
          title: 'Interaction results',
          description:
            'Buttons can append new values while the widget is running.',
          chartType: 'pie',
          height: 300,
          data: `{"labels":["Starter value"],"datasets":[{"label":"Values","data":[3],"backgroundColor":["rgba(0,124,102,0.8)"]}]}`,
        },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['tutorial', 'interactivity', 'buttons', 'charts', 'tasks'],
  },
  {
    id: 'template-content-load-reference-pack',
    name: 'Content Load Reference Pack Template',
    description:
      'A heavier reference widget that combines PDF, image, long text, list, chart, and summary text blocks.',
    category: 'Knowledge Workspace',
    components: [
      {
        id: 'template-content-load-title',
        type: 'Label',
        props: {
          text: 'Content Load Reference Pack',
          variant: 'h4',
          gutterBottom: true,
          useCustomColor: true,
          customColor: '#D81B60',
          fontWeight: 800,
        },
      },
      {
        id: 'template-content-load-overview',
        type: 'LongText',
        props: {
          __blockType: 'LongText',
          title: 'Reference brief',
          text: 'Use this widget when a dashboard needs to carry several kinds of reference material at once. It includes a PDF for source material, an image for visual context, a long note for interpretation, a checklist for review steps, and a compact chart with short commentary.',
          callout: true,
        },
      },
      {
        id: 'template-content-load-media-grid',
        type: 'GridBox',
        props: { columns: 2, spacing: 3, responsive: true },
        children: [
          {
            id: 'template-content-load-pdf',
            type: 'PdfBlock',
            props: {
              __blockType: 'PdfBlock',
              src: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
              title: 'Reference PDF',
              height: 420,
            },
          },
          {
            id: 'template-content-load-image',
            type: 'ImageBlock',
            props: {
              __blockType: 'ImageBlock',
              src: '/images/tutorial-blocks-concept.svg',
              alt: 'Reference blocks arranged in a widget',
              caption:
                'Use image blocks for diagrams, screenshots, maps, or quick visual references.',
              maxHeight: 320,
            },
          },
        ],
      },
      {
        id: 'template-content-load-notes-grid',
        type: 'GridBox',
        props: { columns: 2, spacing: 3, responsive: true },
        children: [
          {
            id: 'template-content-load-reading-notes',
            type: 'LongText',
            props: {
              __blockType: 'LongText',
              title: 'Reading notes',
              text: 'Summarize the important findings here. Keep the note practical: what the source says, why it matters, what decisions it affects, and what still needs verification.',
              callout: false,
            },
          },
          {
            id: 'template-content-load-checklist',
            type: 'ListBlock',
            props: {
              __blockType: 'ListBlock',
              title: 'Review checklist',
              items:
                'Open and scan the PDF\nCompare the diagram with the source\nCapture key definitions\nMark unresolved questions\nUpdate the chart summary',
              ordered: false,
              interactiveChecklist: true,
            },
          },
        ],
      },
      {
        id: 'template-content-load-mix',
        type: 'GridBox',
        props: { columns: 2, spacing: 3, responsive: true },
        children: [
          {
            id: 'template-content-load-chart',
            type: 'Chart',
            props: {
              title: 'Reference Coverage',
              chartType: 'pie',
              height: 260,
              description:
                'A compact chart for coverage, confidence, or source mix.',
              data: `{"labels":["PDF","Image","Notes","Checklist"],"datasets":[{"data":[35,20,30,15],"backgroundColor":["rgba(216,27,96,0.8)","rgba(25,118,210,0.8)","rgba(0,124,102,0.8)","rgba(251,140,0,0.8)"]}]}`,
            },
          },
          {
            id: 'template-content-load-summary',
            type: 'FieldSet',
            props: {
              legend: 'Short synthesis',
              padding: 2,
              borderRadius: 8,
              borderColor: '#D81B60',
              legendColor: '#D81B60',
              useCustomBorderColor: true,
              useCustomLegendColor: true,
            },
            children: [
              {
                id: 'template-content-load-summary-text',
                type: 'Label',
                props: {
                  text: 'This mixed area pairs a small chart with a plain text summary so the widget can show both evidence and interpretation in one place.',
                  variant: 'body1',
                },
              },
            ],
          },
        ],
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['content', 'pdf', 'image', 'long text', 'reference'],
  },
  {
    id: 'template-grouping-layout-tutorial',
    name: 'Grouping Layout Tutorial Template',
    description:
      'A practical tutorial that demonstrates FieldSet, FlexBox, and GridBox layout groups with nested examples.',
    category: 'Knowledge Workspace',
    components: [
      {
        id: 'template-grouping-title',
        type: 'Label',
        props: {
          text: 'Grouping Layout Tutorial',
          variant: 'h4',
          gutterBottom: true,
          useCustomColor: true,
          customColor: '#007C66',
          fontWeight: 800,
        },
      },
      {
        id: 'template-grouping-intro',
        type: 'LongText',
        props: {
          __blockType: 'LongText',
          title: 'What grouping blocks do',
          text: 'Grouping blocks control how other blocks sit together. FieldSet gives a named section, FlexBox lines items up in a row or column, and GridBox creates repeated columns for dashboards or comparisons.',
          callout: true,
        },
      },
      {
        id: 'template-grouping-fieldset-demo',
        type: 'FieldSet',
        props: {
          legend: 'FieldSet: named section',
          padding: 2,
          borderRadius: 8,
          borderColor: '#007C66',
          legendColor: '#007C66',
          useCustomBorderColor: true,
          useCustomLegendColor: true,
        },
        children: [
          {
            id: 'template-grouping-fieldset-copy',
            type: 'Label',
            props: {
              text: 'Use FieldSet when the content has one clear topic and benefits from a visible title.',
              variant: 'body1',
            },
          },
          {
            id: 'template-grouping-fieldset-nested-list',
            type: 'ListBlock',
            props: {
              __blockType: 'ListBlock',
              title: 'Good FieldSet uses',
              items:
                'Reference details\nA form section\nA status summary\nA collapsible explanation',
              ordered: false,
              interactiveChecklist: false,
            },
          },
        ],
      },
      {
        id: 'template-grouping-flex-demo',
        type: 'FieldSet',
        props: {
          legend: 'FlexBox: align related items',
          padding: 2,
          borderRadius: 8,
          borderColor: '#1976D2',
          legendColor: '#1976D2',
          useCustomBorderColor: true,
          useCustomLegendColor: true,
        },
        children: [
          {
            id: 'template-grouping-flex-copy',
            type: 'LongText',
            props: {
              __blockType: 'LongText',
              title: 'FlexBox pattern',
              text: 'Use FlexBox when items should sit beside each other, wrap when space is tight, or stack in a controlled order. It works well for compact status rows and action groups.',
              callout: false,
            },
          },
          {
            id: 'template-grouping-flex-row',
            type: 'FlexBox',
            props: {
              direction: 'row',
              justifyContent: 'space-between',
              alignItems: 'stretch',
              spacing: 2,
              wrap: 'wrap',
            },
            children: [
              {
                id: 'template-grouping-flex-item-one',
                type: 'FieldSet',
                props: {
                  legend: 'Status',
                  padding: 1.5,
                  borderRadius: 8,
                },
                children: [
                  {
                    id: 'template-grouping-flex-item-one-label',
                    type: 'Label',
                    props: {
                      text: 'Ready',
                      variant: 'h6',
                      useCustomColor: true,
                      customColor: '#2E7D32',
                      fontWeight: 700,
                    },
                  },
                ],
              },
              {
                id: 'template-grouping-flex-item-two',
                type: 'FieldSet',
                props: {
                  legend: 'Owner',
                  padding: 1.5,
                  borderRadius: 8,
                },
                children: [
                  {
                    id: 'template-grouping-flex-item-two-label',
                    type: 'Label',
                    props: {
                      text: 'Team A',
                      variant: 'h6',
                      useCustomColor: true,
                      customColor: '#1976D2',
                      fontWeight: 700,
                    },
                  },
                ],
              },
              {
                id: 'template-grouping-flex-item-three',
                type: 'FieldSet',
                props: {
                  legend: 'Next step',
                  padding: 1.5,
                  borderRadius: 8,
                },
                children: [
                  {
                    id: 'template-grouping-flex-item-three-label',
                    type: 'Label',
                    props: {
                      text: 'Review',
                      variant: 'h6',
                      useCustomColor: true,
                      customColor: '#EF6C00',
                      fontWeight: 700,
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'template-grouping-grid-demo',
        type: 'FieldSet',
        props: {
          legend: 'GridBox: repeat columns',
          padding: 2,
          borderRadius: 8,
          borderColor: '#7B1FA2',
          legendColor: '#7B1FA2',
          useCustomBorderColor: true,
          useCustomLegendColor: true,
        },
        children: [
          {
            id: 'template-grouping-grid-copy',
            type: 'Label',
            props: {
              text: 'Use GridBox when each child should occupy a predictable column. This is useful for dashboards, comparisons, and side by side examples.',
              variant: 'body1',
            },
          },
          {
            id: 'template-grouping-grid-inner',
            type: 'GridBox',
            props: { columns: 3, spacing: 2, responsive: true },
            children: [
              {
                id: 'template-grouping-grid-card-one',
                type: 'LongText',
                props: {
                  __blockType: 'LongText',
                  title: 'Column 1',
                  text: 'A note can sit in one grid column.',
                  callout: true,
                },
              },
              {
                id: 'template-grouping-grid-card-two',
                type: 'ListBlock',
                props: {
                  __blockType: 'ListBlock',
                  title: 'Column 2',
                  items: 'Point A\nPoint B\nPoint C',
                  ordered: false,
                  interactiveChecklist: false,
                },
              },
              {
                id: 'template-grouping-grid-card-three',
                type: 'FieldSet',
                props: {
                  legend: 'Column 3',
                  padding: 1.5,
                  borderRadius: 8,
                },
                children: [
                  {
                    id: 'template-grouping-grid-card-three-label',
                    type: 'Label',
                    props: {
                      text: 'Nested groups are useful when a grid item needs its own title.',
                      variant: 'body2',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'template-grouping-summary',
        type: 'ListBlock',
        props: {
          __blockType: 'ListBlock',
          title: 'Rule of thumb',
          items:
            'FieldSet: name and contain a topic\nFlexBox: align a small row or column\nGridBox: create repeatable columns\nNested groups: combine these patterns for real dashboards',
          ordered: false,
          interactiveChecklist: false,
        },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['tutorial', 'grouping', 'layout', 'fieldset', 'flex', 'grid'],
  },
  {
    id: 'template-knowledge-tutorial',
    name: 'StudyMesh Tutorial Template',
    description:
      'A visual guide that explains Study Guides, pages, notes, exercises, and the normal StudyMesh workflow.',
    category: 'Knowledge Workspace',
    components: [
      {
        id: 'template-tutorial-title',
        type: 'Label',
        props: {
          text: 'StudyMesh Tutorial',
          variant: 'h4',
          gutterBottom: true,
          useCustomColor: true,
          customColor: '#007C66',
          fontWeight: 800,
        },
      },
      {
        id: 'template-tutorial-hero',
        type: 'GridBox',
        props: { columns: 2, spacing: 3, responsive: true },
        children: [
          {
            id: 'template-tutorial-hero-copy',
            type: 'LongText',
            props: {
              __blockType: 'LongText',
              title: 'The mental model',
              text: 'StudyMesh has three layers:\n\n1. Blocks are the small pieces: text, lists, images, PDFs, inputs, buttons, charts, and layout groups.\n2. Widgets are reusable knowledge objects made from blocks.\n3. Dashboards are pages where widgets live together and can be arranged into a useful workspace.',
              callout: true,
            },
          },
          {
            id: 'template-tutorial-dashboard-image',
            type: 'ImageBlock',
            props: {
              __blockType: 'ImageBlock',
              src: '/images/tutorial-dashboard-concept.svg',
              alt: 'Dashboard canvas with widgets arranged inside it',
              caption:
                'A dashboard is the canvas. Widgets are the reusable pieces you place inside it.',
              maxHeight: 280,
            },
          },
        ],
      },
      {
        id: 'template-tutorial-workflow',
        type: 'GridBox',
        props: { columns: 3, spacing: 2, responsive: true },
        children: [
          {
            id: 'template-tutorial-widget-studio',
            type: 'LongText',
            props: {
              __blockType: 'LongText',
              title: '1. Create a widget',
              text: 'Open Widget Studio when you want to build one reusable piece of knowledge. Focus only on the widget: choose blocks, edit them, preview, then save.',
              callout: true,
            },
          },
          {
            id: 'template-tutorial-dashboard-builder',
            type: 'LongText',
            props: {
              __blockType: 'LongText',
              title: '2. Create a dashboard',
              text: 'Open or create a dashboard, then use Widget → My Widgets to add saved widgets. Move widgets by dragging their tab and resize sections with the separators.',
              callout: true,
            },
          },
          {
            id: 'template-tutorial-viewer',
            type: 'LongText',
            props: {
              __blockType: 'LongText',
              title: '3. View or edit later',
              text: 'Saved dashboards open in viewer mode so they feel clean. Use the pencil when you want to go back into editing and change the layout or add more widgets.',
              callout: true,
            },
          },
        ],
      },
      {
        id: 'template-tutorial-blocks-visual',
        type: 'GridBox',
        props: { columns: 2, spacing: 3, responsive: true },
        children: [
          {
            id: 'template-tutorial-blocks-image',
            type: 'ImageBlock',
            props: {
              __blockType: 'ImageBlock',
              src: '/images/tutorial-blocks-concept.svg',
              alt: 'Widget blocks including text, input, button, chart, image, and PDF',
              caption:
                'Blocks are the vocabulary of a widget. Combine them to explain, collect, calculate, or visualise information.',
              maxHeight: 300,
            },
          },
          {
            id: 'template-tutorial-block-list',
            type: 'ListBlock',
            props: {
              __blockType: 'ListBlock',
              title: 'What each block is for',
              items:
                'Long Text: explanations, notes, wiki pages, study summaries\nList: concepts, steps, references, or checklists\nImage: diagrams, screenshots, sketches, reference visuals\nPDF: papers, docs, specs, manuals\nAnswer Box: collect values or notes\nButton: trigger actions or interactivity\nChart: visualise values\nLayout Groups: organise everything cleanly',
              ordered: false,
              interactiveChecklist: false,
            },
          },
        ],
      },
      {
        id: 'template-tutorial-mini-demo',
        type: 'FieldSet',
        props: {
          legend: 'Mini example: a widget can mix content and controls',
          padding: 2,
          borderRadius: 8,
          borderColor: '#007C66',
          legendColor: '#007C66',
          useCustomBorderColor: true,
          useCustomLegendColor: true,
        },
        children: [
          {
            id: 'template-tutorial-mini-copy',
            type: 'Label',
            props: {
              text: 'A widget can explain something, ask for input, include a button, and show a chart — all as one reusable object. Try typing a number below and pressing the button to append it to the chart.',
              variant: 'body1',
            },
          },
          {
            id: 'template-tutorial-input-example',
            type: 'TextField',
            props: {
              label: 'Value to add',
              placeholder: 'Example: 12',
              type: 'number',
              fullWidth: true,
              helperText: 'Type a number, then press the button below.',
            },
          },
          {
            id: 'template-tutorial-button-example',
            type: 'Button',
            props: {
              text: 'Add input value to chart',
              variant: 'contained',
              color: 'primary',
              clickAction: 'addChartValue',
              chartLabelSource: 'static',
              chartLabel: 'Input value',
              chartValueSource: 'firstInput',
            },
          },
          {
            id: 'template-tutorial-chart-example',
            type: 'Chart',
            props: {
              title: 'Example chart',
              chartType: 'pie',
              height: 240,
              description: 'Charts turn widget data into a visual summary.',
              data: `{"labels":["Text","Inputs","Charts","Media"],"datasets":[{"data":[30,25,25,20],"backgroundColor":["rgba(0,124,102,0.8)","rgba(25,118,210,0.8)","rgba(251,140,0,0.8)","rgba(142,36,170,0.8)"]}]}`,
            },
          },
        ],
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['tutorial', 'widgets', 'dashboards', 'blocks'],
  },
]

// Function to clone a template and generate new IDs
export const cloneTemplate = (templateId: string): CustomWidget | null => {
  const template = WIDGET_TEMPLATES.find((t) => t.id === templateId)
  if (!template) {
    return null
  }

  // Generate a new ID for the widget
  const newWidget: CustomWidget = {
    ...JSON.parse(JSON.stringify(template)),
    id: `widget-${Date.now()}`,
    name: `${template.name.replace(' Template', '')}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  // Generate new IDs for all components recursively
  const regenerateIds = (components: any[]): any[] => {
    return components.map((component) => {
      const newComponent = {
        ...component,
        id: `component-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      }

      if (newComponent.children && Array.isArray(newComponent.children)) {
        newComponent.children = regenerateIds(newComponent.children)
      }

      return newComponent
    })
  }

  newWidget.components = regenerateIds(newWidget.components)
  return newWidget
}
