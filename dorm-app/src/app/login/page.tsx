'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
      } else {
        router.push('/');
        router.refresh(); // Refresh to update layout state
      }
    } catch (err) {
      setError('Network error, please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30rem] h-[30rem] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="bg-slate-900 border-2 border-slate-800 p-8 rounded-2xl shadow-[8px_8px_0_0_#1d4aff] w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-cyan-400 tracking-tight font-mono">DormAdmin</h1>
          <p className="text-slate-400 mt-2 text-sm font-mono font-bold">ลงชื่อเข้าใช้ระบบจัดการหอพัก</p>
        </div>

        {error && (
          <div className="bg-[#f33022] border-2 border-[#b91c1c] shadow-[4px_4px_0_0_#7f1d1d] text-white p-3 rounded-lg mb-6 text-sm text-center font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-1.5 font-mono">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 bg-[#1d1f27] border-2 border-slate-700 rounded-xl focus:bg-slate-900 focus:border-blue-500 outline-none transition-all text-white placeholder-slate-500 shadow-[4px_4px_0_0_#f7a501] font-mono"
              placeholder="กรอกชื่อผู้ใช้งาน"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-1.5 font-mono">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-[#1d1f27] border-2 border-slate-700 rounded-xl focus:bg-slate-900 focus:border-blue-500 outline-none transition-all text-white placeholder-slate-500 shadow-[4px_4px_0_0_#f7a501] font-mono"
              placeholder="กรอกรหัสผ่าน"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#f7a501] hover:bg-yellow-500 text-black font-black py-3 rounded-xl transition-all duration-300 border-2 border-[#b77a00] shadow-[6px_6px_0_0_#78350f] disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-1 font-mono text-lg"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                กำลังเข้าสู่ระบบ...
              </span>
            ) : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </div>
  );
}
