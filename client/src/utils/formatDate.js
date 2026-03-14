import { format } from 'date-fns'

export const formatDate = (d) =>
  d ? format(new Date(d), 'dd MMM yyyy') : '--'

export const formatDateTime = (d) =>
  d ? format(new Date(d), 'dd MMM yyyy, HH:mm') : '--'
