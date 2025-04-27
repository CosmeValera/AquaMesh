import { useState, useEffect } from 'react'

export interface Panel {
  name: string;
  items: Item[];
}

export interface Item {
  name: string;
  component: string;
  url: string;
  customProps: CustomProps;
}

interface CustomProps {
  [key: string]: unknown;
}

const useTopNavBarWidgets = () => {
  const [topNavBarWidgets, setTopNavBarWidgets] = useState<Panel[]>([])

  useEffect(() => {
    fetch('/config/widgets.json')
      .then(response => response.json())
      .then(data => {
        setTopNavBarWidgets(data)
      })
      .catch(error => console.error('Error fetching widgets.json:', error))
  }, [])

  return { topNavBarWidgets }
}

export default useTopNavBarWidgets
