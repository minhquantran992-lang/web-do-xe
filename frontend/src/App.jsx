import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Bikes from './pages/Bikes.jsx';
import BikeDetails from './pages/BikeDetails.jsx';
import Configurator from './pages/Configurator.jsx';
import Parts from './pages/Parts.jsx';
import Builds from './pages/Builds.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import BuildDetail from './pages/BuildDetail.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Terms from './pages/Terms.jsx';
import Privacy from './pages/Privacy.jsx';
import AuthCallback from './pages/AuthCallback.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import ResetByCode from './pages/ResetByCode.jsx';
import BookingStatus from './pages/BookingStatus.jsx';
import MyConfigurations from './pages/MyConfigurations.jsx';
import AdminCars from './pages/AdminCars.jsx';
import AdminShadow from './pages/AdminShadow.jsx';
import AdminTickets from './pages/AdminTickets.jsx';
import AdminFinance from './pages/AdminFinance.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Custom from './pages/Custom.jsx';
import Marketplace from './pages/Marketplace.jsx';
import Advisor from './pages/Advisor.jsx';
import Profile from './pages/Profile.jsx';
import SearchResults from './pages/SearchResults.jsx';
import Shop from './pages/Shop.jsx';
import SellerCenter from './pages/seller/SellerCenter.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import { useAuth } from './services/auth/AuthContext.jsx';
import { LanguageProvider } from './services/i18n.jsx';
import AiAssistant from './components/AiAssistant.jsx';

const Page = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
};

const RequireAuth = ({ children }) => {
  const { isAuthed } = useAuth();
  const location = useLocation();
  if (!isAuthed) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return children;
};

const RequireAdmin = ({ children }) => {
  const { isAuthed, user } = useAuth();
  const location = useLocation();
  if (!isAuthed) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  const isAdmin = Boolean(user?.isAdmin) || String(user?.role || '').trim().toUpperCase() === 'ADMIN';
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
};

const App = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthed, user } = useAuth();
  const isConfigurator = location.pathname.startsWith('/configurator') || location.pathname.startsWith('/customize');
  const role = String(user?.role || '').trim().toUpperCase();

  useEffect(() => {
    if (!isAuthed) return;
    if (role !== 'VENDOR') return;
    if (user?.isAdmin) return;
    let pending = false;
    try {
      pending = localStorage.getItem('carbanana_b2b_pending_vendor') === '1';
    } catch {}
    if (!pending) return;
    try {
      localStorage.removeItem('carbanana_b2b_pending_vendor');
    } catch {}
    navigate('/seller-center', { replace: true });
  }, [isAuthed, navigate, role, user?.isAdmin]);

  return (
    <div className={isConfigurator ? 'min-h-screen bg-zinc-950 text-zinc-100' : 'min-h-screen bg-zinc-950 text-zinc-100'}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route
            path="/"
            element={
              <Page>
                {isAuthed ? <Navigate to={role === 'VENDOR' ? '/seller-center' : '/dashboard'} replace /> : <Landing />}
              </Page>
            }
          />
          <Route
            path="/landing"
            element={
              <Page>
                <Landing />
              </Page>
            }
          />
          <Route
            path="/advisor"
            element={
              <Page>
                <Advisor />
              </Page>
            }
          />
          <Route
            path="/login"
            element={
              <Page>
                <Login />
              </Page>
            }
          />
          <Route
            path="/register"
            element={
              <Page>
                <Register />
              </Page>
            }
          />
          <Route
            path="/terms"
            element={
              <Page>
                <Terms />
              </Page>
            }
          />
          <Route
            path="/privacy"
            element={
              <Page>
                <Privacy />
              </Page>
            }
          />
          <Route
            path="/auth/callback"
            element={
              <Page>
                <AuthCallback />
              </Page>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <Page>
                <ForgotPassword />
              </Page>
            }
          />
          <Route
            path="/reset-password"
            element={
              <Page>
                <ResetPassword />
              </Page>
            }
          />
          <Route
            path="/reset-by-code"
            element={
              <Page>
                <ResetByCode />
              </Page>
            }
          />
          <Route
            path="/partner-application"
            element={
              <Page>
                <Shop mode="apply" />
              </Page>
            }
          />

          <Route
            path="/marketplace"
            element={
              <Page>
                <Marketplace />
              </Page>
            }
          />
          <Route
            path="/shops/:vendorId"
            element={
              <Page>
                <Marketplace />
              </Page>
            }
          />

          <Route
            element={
              <RequireAuth>
                <DashboardLayout />
              </RequireAuth>
            }
          >
            <Route
              path="/dashboard"
              element={
                <Page>
                  {role === 'VENDOR' ? <Navigate to="/seller-center" replace /> : <Dashboard />}
                </Page>
              }
            />
            <Route
              path="/custom"
              element={
                <Page>
                  <Custom />
                </Page>
              }
            />
            <Route
              path="/shop"
              element={
                <Page>
                  <Shop />
                </Page>
              }
            />
            <Route
              path="/garage"
              element={
                <Page>
                  <MyConfigurations />
                </Page>
              }
            />
            <Route
              path="/profile"
              element={
                <Page>
                  <Profile />
                </Page>
              }
            />
            <Route
              path="/search"
              element={
                <Page>
                  <SearchResults />
                </Page>
              }
            />
            <Route
              path="/my-configs"
              element={
                <Page>
                  <MyConfigurations />
                </Page>
              }
            />
            <Route
              path="/admin/cars"
              element={
                <Page>
                  <AdminCars />
                </Page>
              }
            />
            <Route
              path="/admin/shadow"
              element={
                <RequireAdmin>
                  <Page>
                    <AdminShadow />
                  </Page>
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/tickets"
              element={
                <RequireAdmin>
                  <Page>
                    <AdminTickets />
                  </Page>
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/finance"
              element={
                <RequireAdmin>
                  <Page>
                    <AdminFinance />
                  </Page>
                </RequireAdmin>
              }
            />
          </Route>

          <Route path="/bikes" element={<Page><Bikes /></Page>} />
          <Route path="/bikes/:bikeId" element={<Page><BikeDetails /></Page>} />
          <Route path="/parts" element={<Page><Parts /></Page>} />
          <Route path="/builds" element={<Page><Builds /></Page>} />
          <Route path="/builds/:id" element={<Page><BuildDetail /></Page>} />
          <Route path="/leaderboard" element={<Page><Leaderboard /></Page>} />
          <Route path="/booking/:id" element={<Page><BookingStatus /></Page>} />

          <Route path="/configurator/:bikeId" element={<Configurator />} />
          <Route path="/customize/:carId" element={<Configurator />} />

          <Route
            path="/seller-center"
            element={
              <RequireAuth>
                <Page>
                  <SellerCenter />
                </Page>
              </RequireAuth>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
      <AiAssistant hidden={isConfigurator} />
    </div>
  );
};

const AppWithProviders = () => {
  return (
    <LanguageProvider>
      <App />
    </LanguageProvider>
  );
};

export default AppWithProviders;
