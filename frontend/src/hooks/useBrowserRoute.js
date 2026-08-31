import { useCallback, useEffect, useState } from 'react'

const PAGE_PATHS = {
  actions: '/actions',
  alerts: '/alerts',
  domains: '/domains',
  interfaceLab: '/interface-lab',
  nodes: '/nodes',
  overview: '/',
  services: '/services',
  topics: '/topics',
  visualization: '/visualization',
}

const PATH_PAGES = Object.fromEntries(
  Object.entries(PAGE_PATHS).map(([page, path]) => [path, page]),
)

export function useBrowserRoute() {
  const [activePage, setActivePage] = useState(() => pageFromPathname(
    window.location.pathname,
  ))
  const [routeState, setRouteState] = useState(() => window.history.state ?? null)

  useEffect(() => {
    const handlePopState = () => {
      setActivePage(pageFromPathname(window.location.pathname))
      setRouteState(window.history.state ?? null)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback((page, state = null) => {
    const nextPage = PAGE_PATHS[page] ? page : 'overview'
    const path = pagePath(nextPage)
    const nextState = { page: nextPage, ...(state ?? {}) }
    if (window.location.pathname !== path) {
      window.history.pushState(nextState, '', path)
    } else {
      window.history.replaceState(nextState, '', path)
    }
    setActivePage(nextPage)
    setRouteState(nextState)
  }, [])

  return { activePage, navigate, routeState }
}

export function pagePath(page) {
  return PAGE_PATHS[page] ?? PAGE_PATHS.overview
}

function pageFromPathname(pathname) {
  const normalized = pathname !== '/' ? pathname.replace(/\/+$/, '') : '/'
  return PATH_PAGES[normalized] ?? 'overview'
}
