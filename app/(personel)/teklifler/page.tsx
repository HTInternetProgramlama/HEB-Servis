'use client';
import { Redirect } from '@/components/ui';

// Teklif onayları İş Emirleri > Onay bekliyor filtresine taşındı.
export default function Page() { return <Redirect to="/is-emirleri?filtre=onay" label="Teklif onayları İş Emirleri sayfasında" /> }
