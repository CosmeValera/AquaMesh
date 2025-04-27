import { Layout } from '../../types/types'

export interface DefaultDashboard {
  name: string;
  layout?: Layout
}

export const DEFAULT_DASHBOARD: DefaultDashboard = {
  name: 'Dashboard',
  layout: {
    type: 'row',
    weight: 100,
    children: [],
  },
}
