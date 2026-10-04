import { useState, useEffect, useRef, useCallback } from 'react';
import { Quote } from '../types';

export function useMarketData() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [flashStates, setFlashStates] = useState<Record<string, 'up' | 'down'>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/market`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'SNAPSHOT' && Array.isArray(message.data)) {
          const map: Record<string, Quote> = {};
          message.data.forEach((q: Quote) => {
            map[q.symbol.toUpperCase()] = q;
          });
          setQuotes(map);
        } else if (message.type === 'TICK' && message.data) {
          const tick: Quote = message.data;
          const sym = tick.symbol.toUpperCase();

          setQuotes((prev) => {
            const oldQuote = prev[sym];
            if (oldQuote) {
              const dir = tick.ltp > oldQuote.ltp ? 'up' : tick.ltp < oldQuote.ltp ? 'down' : null;
              if (dir) {
                setFlashStates((f) => ({ ...f, [sym]: dir }));
                setTimeout(() => {
                  setFlashStates((f) => {
                    const copy = { ...f };
                    delete copy[sym];
                    return copy;
                  });
                }, 800);
              }
            }
            return {
              ...prev,
              [sym]: tick,
            };
          });
        }
      } catch (err) {
        console.error('Error parsing market WS message:', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return { quotes, isConnected, flashStates };
}
