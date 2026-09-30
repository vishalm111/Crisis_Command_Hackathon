import React, { useState } from 'react';
import { RouterProvider, useRouter } from './router/Router';

import HomePage from './pages/HomePage';
import CommandCenter from './pages/CommandCenter';
import InteractiveDemo from './pages/InteractiveDemo';
import AboutPage from './pages/AboutPage';
import DocsPage from './pages/DocsPage';

function RouteSwitch() {
  const { path, navigate } = useRouter();
  const [launched, setLaunched] = useState(false);

  // Show HomePage overlay on '/' until user clicks Launch
  const showHome = path === '/' && !launched;

  const handleLaunch = () => {
    setLaunched(true);
  };

  return (
    <>
      {showHome && <HomePage onLaunch={handleLaunch} />}
      <MainView path={path} />
    </>
  );
}

function MainView({ path }) {
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
