import { useEffect, useState } from 'react';
import { effectiveAccountStatus } from '../utils/accountStatus.js';

// Re-render at expiry even when the tab stays open and the network is unavailable.
export default function useAccountStatus(status, premiumExpiresAt) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const expiry = new Date(premiumExpiresAt ?? '').getTime();
    if (status !== 'admin' || !(expiry > Date.now())) return;
    const timer = setTimeout(() => setTick((value) => value + 1), Math.min(expiry - Date.now() + 1, 2147483647));
    return () => clearTimeout(timer);
  }, [status, premiumExpiresAt, tick]);
  return effectiveAccountStatus({ status, premiumExpiresAt });
}
