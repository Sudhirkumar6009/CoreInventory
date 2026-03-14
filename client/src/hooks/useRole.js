import { useAuthStore } from '../store/authStore'

/**
 * useRole — role-based access helper.
 *
 * isManager  → user.role === 'manager'
 * isStaff    → user.role === 'staff'
 * can(roles) → returns true if user's role is in the given array
 */
export const useRole = () => {
  const user = useAuthStore((s) => s.user)
  const role = user?.role || 'staff'

  return {
    role,
    isManager: role === 'manager',
    isStaff: role === 'staff',
    /** @param {string[]} allowedRoles */
    can: (allowedRoles) => allowedRoles.includes(role),
  }
}
