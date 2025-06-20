import { useState, useEffect } from 'react';

export const useMessage = () => {
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return [message, setMessage];
};