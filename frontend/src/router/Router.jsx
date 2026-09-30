import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const RouterContext = createContext({
  path: '/',
  navigate: () => {},
});

export function useRouter() {
  return useContext(RouterContext);
}

function getInitialPath() {
  if (typeof window === 'undefined') return '/';
  
  // Check hash first (e.g. #/demo or #/app) for static hosting compatibility
  if (window.location.hash && window.location.hash.startsWith('#/')) {
    return window.location.hash.slice(1);
  }
  
  const pathname = window.location.pathname;
  if (pathname === '' || pathname === '/') return '/';
  
  // Normalize known paths
  const known = ['/app', '/demo', '/about', '/docs'];
  for (const k of known) {
    if (pathname === k || pathname.startsWith(k + '/')) {
      return k;
    }
  }
  return '/';
}

export function RouterProvider({ children }) {
  const [path, setPath] = useState(getInitialPath);

  const navigate = useCallback((to) => {
    if (!to) return;
    const cleanPath = to.startsWith('/') ? to : `/${to}`;
    
    // Update browser history and hash for cross-environment compatibility
    if (window.location.protocol === 'file:') {
      window.location.hash = `#${cleanPath}`;
    } else {
      try {
        window.history.pushState(null, '', cleanPath);
      } catch {
        window.location.hash = `#${cleanPath}`;
      }
    }
    
    setPath(cleanPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setPath(getInitialPath());
    };

    const handleHashChange = () => {
      if (window.location.hash && window.location.hash.startsWith('#/')) {
        setPath(window.location.hash.slice(1));
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  return (
    <RouterContext.Provider value={{ path, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function Link({ href, className = '', children, onClick, ...props }) {
  const { navigate } = useRouter();

  const handleClick = (e) => {
    // Let normal cmd+click or ctrl+click open in new tab
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    if (onClick) onClick(e);
    navigate(href);
  };

  return (
    <a href={href} className={className} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}
