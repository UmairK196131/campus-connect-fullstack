'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet } from '../lib/api';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    apiGet('/me')
      .then(() => router.replace('/home'))
      .catch(() => router.replace('/login'));
  }, [router]);

  return null;
}
