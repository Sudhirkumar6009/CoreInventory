import { Link, Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

/* ── Feature cards shown on the landing page ── */
const FEATURES = [
  {
    title: 'Real-Time Tracking',
    desc: 'Monitor stock levels, movements, and locations across every warehouse in real time.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
  },
  {
    title: 'Role-Based Access',
    desc: 'Managers and staff each see only what they need — secure, streamlined, focused.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    title: 'Seamless Operations',
    desc: 'Receipts, deliveries, transfers, and adjustments — all in one intuitive workflow.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
]

export default function HomePage() {
  const token = useAuthStore((s) => s.token)

  /* Already logged-in → skip straight to dashboard */
  if (token) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-dark via-brand-mid to-[#0f3460] flex flex-col relative overflow-hidden">
      {/* ── Decorative blurs (same as AuthLayout) ── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-brand-accent/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-brand-accent/5 rounded-full blur-3xl" />
      </div>

      {/* ── Top navigation bar ── */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-brand-accent to-rose-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-accent/30">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </div>
          <span className="text-white text-lg font-bold tracking-tight">CoreInventory</span>
        </div>

        <nav className="flex items-center gap-3">
          <Link
            to="/login"
            id="home-login-btn"
            className="px-5 py-2 text-sm font-medium text-white/90 hover:text-white border border-white/20 rounded-lg backdrop-blur-sm hover:bg-white/10 transition-all duration-200"
          >
            Sign In
          </Link>
          <Link
            to="/signup"
            id="home-register-btn"
            className="px-5 py-2 text-sm font-medium text-white bg-brand-accent hover:bg-rose-600 rounded-lg shadow-lg shadow-brand-accent/25 transition-all duration-200"
          >
            Get Started
          </Link>
        </nav>
      </header>

      {/* ── Hero section ── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="animate-scale-in max-w-2xl">
          {/* Logo mark */}
          <div className="w-20 h-20 bg-gradient-to-br from-brand-accent to-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-brand-accent/30">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight">
            Warehouse Management,{' '}
            <span className="bg-gradient-to-r from-brand-accent to-rose-400 bg-clip-text text-transparent">
              Simplified
            </span>
          </h1>

          <p className="mt-5 text-lg md:text-xl text-gray-300 max-w-xl mx-auto leading-relaxed">
            Track inventory, manage operations, and streamline your warehouse — all from a single, powerful dashboard.
          </p>

          {/* CTA buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/signup"
              id="hero-register-btn"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 text-base font-semibold text-white bg-brand-accent hover:bg-rose-600 rounded-xl shadow-xl shadow-brand-accent/30 transition-all duration-200 hover:scale-[1.02]"
            >
              Create Free Account
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              to="/login"
              id="hero-login-btn"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 text-base font-semibold text-white border border-white/20 rounded-xl backdrop-blur-sm hover:bg-white/10 transition-all duration-200"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* ── Feature cards ── */}
        <div className="mt-20 mb-12 grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-4xl w-full animate-fade-in">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white/[0.06] backdrop-blur-md border border-white/10 rounded-2xl p-6 text-left hover:bg-white/[0.1] transition-all duration-300 group"
            >
              <div className="w-11 h-11 rounded-xl bg-brand-accent/15 flex items-center justify-center text-brand-accent mb-4 group-hover:bg-brand-accent/25 transition-colors duration-300">
                {f.icon}
              </div>
              <h3 className="text-white font-semibold text-sm mb-1.5">{f.title}</h3>
              <p className="text-gray-400 text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 text-center py-6 border-t border-white/5">
        <p className="text-xs text-gray-500">
          &copy; {new Date().getFullYear()} CoreInventory. Built for modern warehouses.
        </p>
      </footer>
    </div>
  )
}
