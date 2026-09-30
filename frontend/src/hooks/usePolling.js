import { useState, useEffect, useCallback } from 'react';

export function usePolling(fn, ms = 1500) {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    const execute = useCallback(async () => {
        try {
            const result = await fn();
            setData(result);
            setError(null);
        } catch (err) {
            setError(err);
        }
    }, [fn]);

    useEffect(() => {
        execute();
        const intervalId = setInterval(execute, ms);
        return () => clearInterval(intervalId);
    }, [execute, ms]);

    return { data, error };
}
