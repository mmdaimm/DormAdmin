'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import LogoutButton from '@/components/LogoutButton';

const NAV_CARDS = [
  { href: '/', emoji: '📊', titleTH: 'แดชบอร์ด', roles: ['admin', 'owner'] },
  { href: '/invoices', emoji: '📄', titleTH: 'ออกบิล', roles: ['admin', 'owner'] },
  { href: '/invoice-manager', emoji: '📋', titleTH: 'จัดการบิล', roles: ['owner', 'admin'] },
  { href: '/tenants', emoji: '👥', titleTH: 'ผู้เช่า', roles: ['owner'] },
  { href: '/accounting', emoji: '📈', titleTH: 'บัญชี', roles: ['owner'] },
  { href: '/settings', emoji: '⚙️', titleTH: 'ตั้งค่า', roles: ['owner'] },
];

export default function Sidebar({ userRole, username }: { userRole: string, username: string }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  
  // To avoid hydration mismatch if needed, but here it's simple enough
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const visibleNav = NAV_CARDS.filter(n => n.roles.includes(userRole));

  return (
    <>
      {/* Mobile Top Nav */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white/60 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-50">
        <div className="text-xl font-bold text-slate-900 tracking-tight">DormAdmin</div>
        <button onClick={() => setIsOpen(!isOpen)} className="text-slate-600 p-2">
          {isOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white/60 backdrop-blur-xl border-r border-slate-200 
        transform transition-transform duration-300 ease-in-out flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:sticky md:top-0 md:h-screen
      `}>
        <div className="p-6 hidden md:block">
          <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-violet-400 tracking-tight">DormAdmin</div>
        </div>
        
        <div className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
          {mounted && visibleNav.map(nav => {
            const isActive = pathname === nav.href;
            return (
              <Link 
                key={nav.href} 
                href={nav.href}
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                  ${isActive 
                    ? 'bg-indigo-50 text-indigo-600 border border-indigo-200 shadow-sm font-semibold' 
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }
                `}
              >
                <span className="text-lg">{nav.emoji}</span>
                <span className="font-medium">{nav.titleTH}</span>
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <div className="px-4 py-3 mb-3 rounded-xl bg-white shadow-sm border border-slate-200 flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
               {username.charAt(0).toUpperCase()}
             </div>
             <div className="flex-1 min-w-0">
               <div className="text-sm font-bold text-slate-800 truncate">{username}</div>
               <div className="text-xs text-slate-500 uppercase font-medium">{userRole}</div>
             </div>
          </div>
          <div className="w-full [&>button]:w-full">
            <LogoutButton />
          </div>
        </div>
      </div>
      
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-50/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
