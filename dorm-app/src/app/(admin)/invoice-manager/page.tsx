import { cookies } from 'next/headers';
import { decrypt } from '@/lib/auth';
import InvoiceManagerClient from './InvoiceManagerClient';

export default async function InvoiceManagerPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const session = await decrypt(token);
  const userRole = session?.role ?? 'admin';

  return <InvoiceManagerClient userRole={userRole} />;
}
