import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import Dashboard from '@/pages/Dashboard';
import Maintenance from '@/pages/Maintenance';
import Repair from '@/pages/Repair';
import DataInput from '@/pages/DataInput';
import Settings from '@/pages/Settings';
import About from '@/pages/About';
import Licensing from '@/pages/Licensing';
import TestMode from '@/pages/TestMode';
import ContactDeveloper from '@/pages/ContactDeveloper';
import { useLicense } from '@/hooks/useLicense';
import SplashScreen from '@/components/SplashScreen';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { status } = useLicense();
  
  if (status === 'expired' && window.location.pathname !== '/license') {
    return <Navigate to="/license" replace />;
  }
  
  return <>{children}</>;
};

function App() {
  const [showSplash, setShowSplash] = React.useState(true);

  React.useEffect(() => {
    // Disable right-click and inspection shortcuts
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.keyCode === 123 || 
        (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74)) ||
        (e.ctrlKey && e.keyCode === 85)
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/maintenance" element={<Maintenance />} />
                  <Route path="/repair" element={<Repair />} />
                  <Route path="/data" element={<DataInput />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/license" element={<Licensing />} />
                  <Route path="/test-mode" element={<TestMode />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/contact" element={<ContactDeveloper />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
