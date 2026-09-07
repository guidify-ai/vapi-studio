import { NavLink, Outlet } from 'react-router-dom';

const links = [
  { to: '/flow', label: 'Flow' },
  { to: '/conversations', label: 'Conversations' },
  { to: '/analytics', label: 'Analytics' },
] as const;

export function StudioLayout() {
  return (
    <div className="studio-shell">
      <header className="studio-topbar">
        <div className="studio-brand">
          <strong>Vapi Studio</strong>
          <span className="studio-brand-meta">operator</span>
        </div>
        <nav className="studio-nav" aria-label="Studio">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                isActive ? 'studio-nav-link is-active' : 'studio-nav-link'
              }
              end={l.to === '/flow'}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <div className="studio-outlet">
        <Outlet />
      </div>
    </div>
  );
}
