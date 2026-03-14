import { Outlet } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import TopNav from '../components/nav/TopNav'
import Breadcrumb from '../components/nav/Breadcrumb'
import ProfileMenu from '../components/nav/ProfileMenu'
import { useUiStore } from '../store/uiStore'
import clsx from 'clsx'

export default function AppLayout() {
  const { sidebarOpen } = useUiStore()

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: 500,
          },
          success: {
            iconTheme: { primary: '#22c55e', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
          },
        }}
      />
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          className={clsx(
            'transition-all duration-300 ease-in-out flex-shrink-0',
            sidebarOpen ? 'w-64' : 'w-0'
          )}
        >
          <div className={clsx(
            'h-full w-64 bg-white border-r border-gray-100 overflow-y-auto transition-transform duration-300',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}>
            <ProfileMenu />
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-5">
            <Breadcrumb />
            <div className="animate-fade-in">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
