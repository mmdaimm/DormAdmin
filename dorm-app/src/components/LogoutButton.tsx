'use client';

import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="text-sm font-medium text-slate-300 hover:text-white px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
    >
      ออกจากระบบ
    </button>
  );
}
