'use client';

import { useEffect } from 'react';

export default function GlobalPickerHandler() {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLInputElement;
      if (
        target &&
        target.tagName === 'INPUT' &&
        (target.type === 'date' || target.type === 'month' || target.type === 'datetime-local' || target.type === 'time')
      ) {
        try {
          target.showPicker();
        } catch {}
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return null;
}
