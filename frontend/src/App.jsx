import React from 'react';
import { RouterProvider, useRouter } from './router/Router';

import LandingPage from './pages/LandingPage';
import CommandCenter from './pages/CommandCenter';
import InteractiveDemo from './pages/InteractiveDemo';
import AboutPage from './pages/AboutPage';
import DocsPage from './pages/DocsPage';

function RouteSwitch() {
  const { path } = useRouter();

  switch (path) {
    case '/app':
      return <CommandCenter />;
    case '/demo':
      return <InteractiveDemo />;
    case '/about':
      return <AboutPage />;
    case '/docs':
      return <DocsPage />;
    case '/':
    default:
      return <LandingPage />;
  }
}

export default function App() {
  return (
    <RouterProvider>
      <RouteSwitch />
    </RouterProvider>
  );
}
