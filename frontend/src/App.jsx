import React, { useState } from 'react';
import { RouterProvider, useRouter } from './router/Router';

import HomePage from './pages/HomePage';
import CommandCenter from './pages/CommandCenter';
import InteractiveDemo from './pages/InteractiveDemo';
import AboutPage from './pages/AboutPage';
import DocsPage from './pages/DocsPage';

function RouteSwitch() {
  const { path } = useRouter();
  const [launched, setLaunched] = useState(false);

  // On '/', show ONLY HomePage until user clicks Launch — don't render CommandCenter behind it
  if (path === '/' && !launched) {
    return <HomePage onLaunch={() => setLaunched(true)} />;
  }

  switch (path) {
    case '/demo':
      return <InteractiveDemo />;
    case '/about':
      return <AboutPage />;
    case '/docs':
      return <DocsPage />;
    case '/app':
    case '/':
    default:
      return <CommandCenter />;
  }
}

export default function App() {
  return (
    <RouterProvider>
      <RouteSwitch />
    </RouterProvider>
  );
}
