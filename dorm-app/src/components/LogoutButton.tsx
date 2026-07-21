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
      className="text-sm font-bold text-white px-4 py-2 rounded-xl bg-slate-900 border-2 border-slate-700 shadow-[4px_4px_0_0_#f33022] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_#f33022] transition-all font-mono"
    >
      ออกจากระบบ
    </button>
  );
}
