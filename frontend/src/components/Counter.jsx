import { useState, useEffect, useRef, useMemo } from 'react';

function Counter({ initialValue = 0, showDouble = true }) {
    const [count, setCount] = useState(initialValue);
    const [isRunning, setIsRunning] = useState(false);
    const countRef = useRef(count);

    // Bug Fix: Keep ref in sync with count state
    useEffect(() => {
        countRef.current = count;
    }, [count]);

    useEffect(() => {
        if (isRunning) {
            const interval = setInterval(() => {
                // Bug Fix: Use functional update to avoid stale closure issue
                setCount(prevCount => prevCount + 1);
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [isRunning]);

    // Bug Fix: Hooks cannot be called conditionally (violates Rules of Hooks)
    // Moved useEffect outside conditional and put the condition inside
    useEffect(() => {
        if (showDouble) {
            console.log('Double value:', count * 2);
        }
    }, [count, showDouble]);

    const logCount = () => {
        console.log('Count from ref:', countRef.current);
    };

    const doubled = useMemo(() => {
        return count * 2;
    }, [count]);

    return (
        <div className="p-4 bg-white rounded-lg shadow">
            <div className="text-2xl font-bold">{count}</div>
            {showDouble && (
                <div className="text-sm text-gray-500">Double: {doubled}</div>
            )}
            <div className="mt-3 space-x-2">
                <button
                    onClick={() => setCount(c => c + 1)}
                    className="px-3 py-1 bg-blue-500 text-white rounded"
                >
                    +1
                </button>
                <button
                    onClick={() => setIsRunning(!isRunning)}
                    className="px-3 py-1 bg-green-500 text-white rounded"
                >
                    {isRunning ? 'Stop' : 'Auto'}
                </button>
                <button
                    onClick={logCount}
                    className="px-3 py-1 bg-gray-500 text-white rounded"
                >
                    Log
                </button>
            </div>
        </div>
    );
}

export default Counter;
