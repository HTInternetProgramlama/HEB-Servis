'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Kanban panosu bu tasarımda yok: eski bağlantılar İş Emirleri'nin "Duruma göre" görünümüne yönlenir. */
export default function WorkshopRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/is-emirleri?gorunum=durum') }, [router]);
  return null;
}
