import { useEffect } from 'react'

export const useDocumentTitle = (title) => {
  useEffect(() => {
    const prev = document.title
    document.title = title ? `${title} — CoreInventory` : 'CoreInventory'
    return () => { document.title = prev }
  }, [title])
}
