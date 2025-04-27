import { useState, useEffect } from 'react';
import { ServiceType } from '../provider/MifProvider';
import { fetchGetAllAquamesh } from './fetchAllAquamesh';

export function useFetch(aquamesh: string, server: string, serviceType: ServiceType) {
  const [data, setData] = useState<any>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const method = async () => {
      setLoading(true);
      
      try {
        const fetchedData = await fetchGetAllAquamesh([aquamesh]);
        setData(fetchedData[0]);
      } catch (err) {
        setError(true);
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    }

    method();
  }, [aquamesh]);

  return { loading, data, error };
}