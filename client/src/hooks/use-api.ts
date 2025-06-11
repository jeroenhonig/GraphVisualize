
import { useState, useCallback } from 'react';

export interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export function useApi<T>() {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    error: null,
    loading: false,
  });

  const execute = useCallback(async (
    apiCall: () => Promise<T>
  ): Promise<ApiResponse<T>> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const data = await apiCall();
      setState({ data, error: null, loading: false });
      return { ok: true, data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, error: errorMessage, loading: false }));
      return { ok: false, error: errorMessage };
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, error: null, loading: false });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

// Specialized hook for graph operations
export function useGraphApi() {
  const api = useApi<any>();

  const loadGraph = useCallback(async (graphId: string) => {
    return api.execute(async () => {
      const response = await fetch(`/api/graphs/${graphId}`);
      if (!response.ok) {
        throw new Error(`Failed to load graph: ${response.statusText}`);
      }
      return response.json();
    });
  }, [api]);

  const saveGraph = useCallback(async (graphData: any) => {
    return api.execute(async () => {
      const response = await fetch('/api/graphs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(graphData),
      });
      if (!response.ok) {
        throw new Error(`Failed to save graph: ${response.statusText}`);
      }
      return response.json();
    });
  }, [api]);

  return {
    ...api,
    loadGraph,
    saveGraph,
  };
}
