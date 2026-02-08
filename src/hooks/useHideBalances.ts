import { useState, useEffect, useCallback } from 'react';

const HIDE_BALANCES_KEY = 'lexopay_hide_balances';

export function useHideBalances() {
  const [hidden, setHidden] = useState(() => {
    return localStorage.getItem(HIDE_BALANCES_KEY) === 'true';
  });

  useEffect(() => {
    localStorage.setItem(HIDE_BALANCES_KEY, hidden.toString());
  }, [hidden]);

  const toggle = useCallback(() => setHidden(prev => !prev), []);

  const mask = useCallback((value: string) => {
    return hidden ? '••••' : value;
  }, [hidden]);

  return { hidden, toggle, mask };
}
