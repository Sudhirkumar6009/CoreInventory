import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  CubeIcon, ExclamationTriangleIcon, InboxIcon,
  TruckIcon, ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline'
import KpiCard from '../../components/common/KpiCard'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { dashboardService } from '../../api/dashboardService'

export default function DashboardPage() {
  useDocumentTitle('Dashboard')
  const navigate = useNavigate()

  const { data: kpis, isLoading: kpiLoading } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: () => dashboardService.getKpis().then((r) => r.data),
    refetchInterval: 60_000,
  })

  const { data: ops, isLoading: opsLoading } = useQuery({
    queryKey: ['dashboard-ops'],
    queryFn: () => dashboardService.getOperationsSummary().then((r) => r.data),
    refetchInterval: 60_000,
  })

  const kpiCards = [
    {
      title: 'Total Products in Stock',
      value: kpis?.totalProducts ?? 0,
      icon: CubeIcon,
      colorClass: 'border-blue-500',
      onClick: () => navigate('/products'),
    },
    {
      title: 'Low / Out of Stock',
      value: kpis?.lowStock ?? 0,
      subValue: kpis?.outOfStock ? `${kpis.outOfStock} out of stock` : undefined,
      icon: ExclamationTriangleIcon,
      colorClass: 'border-amber-500',
      onClick: () => navigate('/products?filter=lowStock'),
    },
    {
      title: 'Pending Receipts',
      value: kpis?.pendingReceipts ?? 0,
      icon: InboxIcon,
      colorClass: 'border-indigo-500',
      onClick: () => navigate('/operations/receipts'),
    },
    {
      title: 'Pending Deliveries',
      value: kpis?.pendingDeliveries ?? 0,
      icon: TruckIcon,
      colorClass: 'border-orange-500',
      onClick: () => navigate('/operations/deliveries'),
    },
    {
      title: 'Transfers Scheduled',
      value: kpis?.scheduledTransfers ?? 0,
      icon: ArrowsRightLeftIcon,
      colorClass: 'border-teal-500',
      onClick: () => navigate('/operations/transfers'),
    },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {kpiCards.map((card) => (
          <KpiCard key={card.title} {...card} loading={kpiLoading} />
        ))}
      </div>

      {/* Operations Quick Access */}
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Operations</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Receipt Card */}
        <div
          onClick={() => navigate('/operations/receipts')}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 cursor-pointer
                     hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
              <InboxIcon className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Receipts</h3>
          </div>
          {opsLoading ? (
            <div className="space-y-2">
              <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
              <div className="h-4 w-24 bg-gray-50 rounded animate-pulse" />
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                <span className="text-xl font-bold text-indigo-600 mr-1">{ops?.receipts?.toReceive ?? 0}</span>
                To Receive
              </p>
              <p className="text-sm text-gray-500 mt-1">
                <span className="font-semibold text-amber-500 mr-1">{ops?.receipts?.waiting ?? 0}</span>
                Waiting
              </p>
            </>
          )}
        </div>

        {/* Delivery Card */}
        <div
          onClick={() => navigate('/operations/deliveries')}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 cursor-pointer
                     hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
              <TruckIcon className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Deliveries</h3>
          </div>
          {opsLoading ? (
            <div className="space-y-2">
              <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
              <div className="h-4 w-24 bg-gray-50 rounded animate-pulse" />
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                <span className="text-xl font-bold text-orange-600 mr-1">{ops?.deliveries?.toDeliver ?? 0}</span>
                To Deliver
              </p>
              <p className="text-sm text-gray-500 mt-1">
                <span className="font-semibold text-amber-500 mr-1">{ops?.deliveries?.waiting ?? 0}</span>
                Waiting
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
