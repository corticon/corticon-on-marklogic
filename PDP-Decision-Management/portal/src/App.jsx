import { useState, useRef, useCallback, useEffect } from 'react'
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import QueryMaintenancePage from './pages/QueryMaintenancePage'
import DeploymentConfigPage from './pages/DeploymentConfigPage'
import DecisionServiceTestPage from './pages/DecisionServiceTestPage'
import { navMenuConfig } from './config/navMenuConfig'

function App() {
  const [theme, setTheme] = useState('dark')
  const location = useLocation()

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  // Sync data-theme to document.body so Kendo popups (rendered at body level) inherit it
  useEffect(() => {
    document.body.setAttribute('data-theme', theme)
  }, [theme])

  // Administration section is expanded by default (only one group, collapsed would be a poor UX)
  const [collapsedSections, setCollapsedSections] = useState(() =>
    Object.fromEntries(navMenuConfig.map(g => [g.key, false]))
  )

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  // --- Nav sidebar resize ---
  const [navWidth, setNavWidth] = useState(216)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  const onDragStart = useCallback((e) => {
    e.preventDefault()
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = navWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [navWidth])

  useEffect(() => {
    const onDragMove = (e) => {
      if (!isDragging.current) return
      const delta = e.clientX - dragStartX.current
      const newWidth = Math.min(500, Math.max(160, dragStartWidth.current + delta))
      setNavWidth(newWidth)
    }
    const onDragEnd = () => {
      if (!isDragging.current) return
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onDragMove)
    document.addEventListener('mouseup', onDragEnd)
    return () => {
      document.removeEventListener('mousemove', onDragMove)
      document.removeEventListener('mouseup', onDragEnd)
    }
  }, [])

  return (
    <div className="app-container" data-theme={theme}>
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <img src="/src/icons/Progress_PrimaryLogo.png" alt="Progress" className="progress-logo" />
            <h1 className="header-title">PDP Decision Management</h1>
          </div>
          <div className="header-right">
            <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle Theme">
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <div className="user-badge">admin</div>
          </div>
        </div>
      </header>

      <div className="app-body">
        <nav className="app-nav" style={{ width: navWidth }}>
          <div className="nav-resize-handle" onMouseDown={onDragStart} />
          {navMenuConfig.map((group) => (
            <div className="nav-section" key={group.key}>
              <div className="nav-section-title" onClick={() => toggleSection(group.key)}>
                <span>{group.group}</span>
                <span className={`nav-section-chevron ${collapsedSections[group.key] ? 'collapsed' : ''}`}>&#9660;</span>
              </div>
              <div className={`nav-section-items ${collapsedSections[group.key] ? 'collapsed' : ''}`}>
                {group.items.map((item) => {
                  const isActive = location.pathname === item.route ||
                    (item.route === '/decision-service-test' && location.pathname === '/')
                  return (
                    <Link
                      key={item.key}
                      to={item.route}
                      className={`nav-item ${isActive ? 'active' : ''}`}
                    >
                      {item.title}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <main className="app-main">
          <Routes future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Route path="/" element={<Navigate to="/decision-service-test" replace />} />
            <Route path="/query-maintenance" element={<QueryMaintenancePage />} />
            <Route path="/deployment-config" element={<DeploymentConfigPage />} />
            <Route path="/decision-service-test" element={<DecisionServiceTestPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App
