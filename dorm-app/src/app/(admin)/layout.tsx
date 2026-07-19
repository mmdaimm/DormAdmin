import { cookies } from 'next/headers';
import { decrypt } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const session = await decrypt(token);
  
  const userRole = session?.role || 'admin';
  const username = session?.username || 'User';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <Sidebar userRole={userRole} username={username} />
      <main className="flex-1 w-full md:max-w-[calc(100vw-16rem)] overflow-x-hidden p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
