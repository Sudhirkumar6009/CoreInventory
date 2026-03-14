import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bars3Icon, BellIcon, MagnifyingGlassIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { useUiStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { NAV_ITEMS } from '../../constants'
import clsx from 'clsx'

export default function TopNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { toggleSidebar } = useUiStore()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [openDropdown, setOpenDropdown] = useState(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdown(null)
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const isActive = (item) => {
    if (item.path) return location.pathname.startsWith(item.path)
    return item.children?.some((c) => location.pathname.startsWith(c.path))
  }

  return (
    <nav className="bg-gradient-to-r from-brand-dark to-brand-mid text-white shadow-lg z-20 flex-shrink-0">
      <div className="max-w-full mx-auto px-4">
        <div className="flex items-center h-14" ref={dropdownRef}>
          {/* Left: Hamburger + Logo */}
          <div className="flex items-center gap-3 mr-6">
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <Bars3Icon className="w-5 h-5" />
            </button>
            <Link to="/dashboard" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-brand-accent to-rose-600 rounded-lg flex items-center justify-center shadow-sm">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </div>
              <span className="font-bold text-base tracking-tight hidden sm:block">CoreInventory</span>
            </Link>
          </div>

          {/* Center: Nav links */}
          <div className="flex items-center gap-1 flex-1">
            {NAV_ITEMS.map((item) => (
              <div key={item.label} className="relative">
                {item.children ? (
                  <>
                    <button
                      onClick={() => setOpenDropdown(openDropdown === item.label ? null : item.label)}
                      className={clsx('nav-link flex items-center gap-1', isActive(item) && 'active')}
                    >
                      {item.label}
                      <ChevronDownIcon className={clsx(
                        'w-3.5 h-3.5 transition-transform duration-200',
                        openDropdown === item.label && 'rotate-180'
                      )} />
                    </button>
                    {openDropdown === item.label && (
                      <div className="absolute top-full left-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 animate-scale-in z-50">
                        {item.children.map((child) => (
                          <button
                            key={child.path}
                            onClick={() => {
                              navigate(child.path)
                              setOpenDropdown(null)
                            }}
                            className={clsx(
                              'w-full text-left px-4 py-2.5 text-sm transition-colors',
                              location.pathname.startsWith(child.path)
                                ? 'text-brand-accent bg-brand-accent/5 font-medium'
                                : 'text-gray-700 hover:bg-gray-50'
                            )}
                          >
                            {child.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    to={item.path}
                    className={clsx('nav-link', isActive(item) && 'active')}
                  >
                    {item.label}
                  </Link>
                )}
              </div>
            ))}
          </div>

          {/* Right: Search, Bell, Avatar */}
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-white/10 transition-colors">
              <MagnifyingGlassIcon className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-lg hover:bg-white/10 transition-colors relative">
              <BellIcon className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-accent rounded-full" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-brand-accent/80 to-rose-600 rounded-full flex items-center justify-center text-xs font-bold">
                  {(user?.name || 'U').charAt(0).toUpperCase()}
                </div>
              </button>
              {showUserMenu && (
                <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 animate-scale-in z-50">
                  <div className="px-4 py-2.5 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{user?.name || 'User'}</p>
                    <p className="text-xs text-gray-500">{user?.email || ''}</p>
                  </div>
                  <button
                    onClick={() => {
                      logout()
                      navigate('/login')
                      setShowUserMenu(false)
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
