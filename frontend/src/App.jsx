import { AnimatePresence, motion } from 'framer-motion';
import { Link, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Bikes from './pages/Bikes.jsx';
import BikeDetails from './pages/BikeDetails.jsx';
import Configurator from './pages/Configurator.jsx';
import Parts from './pages/Parts.jsx';
import Builds from './pages/Builds.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import AuthCallback from './pages/AuthCallback.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import ResetByCode from './pages/ResetByCode.jsx';
import MyConfigurations from './pages/MyConfigurations.jsx';
import AdminCars from './pages/AdminCars.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Custom from './pages/Custom.jsx';
import Marketplace from './pages/Marketplace.jsx';
import { useAuth } from './services/auth/AuthContext.jsx';
import { LanguageProvider, useI18n } from './services/i18n.jsx';

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

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const { lang, t, toggle } = useI18n();

  const linkBase =
    'group flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition';
  const linkActive = 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200 shadow-[0_0_18px_rgba(16,185,129,0.18)]';
  const linkIdle = 'border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-5 backdrop-blur-xl lg:sticky lg:top-6">
          <div className="flex items-center justify-between gap-3">
            <Link to="/dashboard" className="text-lg font-black tracking-tight">
              {t('app_name')}
            </Link>
            <button
              type="button"
              onClick={toggle}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
            >
              {lang === 'vi' ? t('lang_en') : t('lang_vi')}
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-xs text-zinc-500">{t('common_account')}</div>
            <div className="mt-1 text-sm font-semibold text-zinc-100">{user?.email || '—'}</div>
          </div>

          <div className="mt-4 grid gap-2">
            <NavLink
              to="/dashboard"
              className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}
            >
              <span>{t('nav_home')}</span>
              <span className="text-zinc-500 group-hover:text-zinc-300">→</span>
            </NavLink>
            <NavLink to="/custom" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}>
              <span>{t('nav_custom')}</span>
              <span className="text-zinc-500 group-hover:text-zinc-300">→</span>
            </NavLink>
            <NavLink
              to="/marketplace"
              className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}
            >
              <span>{t('nav_marketplace')}</span>
              <span className="text-zinc-500 group-hover:text-zinc-300">→</span>
            </NavLink>
            <NavLink to="/garage" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}>
              <span>{t('nav_garage')}</span>
              <span className="text-zinc-500 group-hover:text-zinc-300">→</span>
            </NavLink>
          </div>

          <div className="mt-4 grid gap-2">
            {user?.isAdmin ? (
              <Link
                to="/admin/cars"
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 hover:bg-white/10"
              >
                <span>{t('nav_admin')}</span>
                <span className="text-zinc-500">→</span>
              </Link>
            ) : null}
            <button
              type="button"
              onClick={logout}
              className="rounded-2xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-left text-sm font-semibold text-red-200 hover:bg-red-950/45"
            >
              {t('nav_logout')}
            </button>
          </div>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const App = () => {
  const location = useLocation();
  const { isAuthed } = useAuth();
  const isConfigurator = location.pathname.startsWith('/configurator') || location.pathname.startsWith('/customize');

  return (
    <div className={isConfigurator ? 'min-h-screen bg-zinc-950 text-zinc-100' : 'min-h-screen bg-zinc-950 text-zinc-100'}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route
            path="/"
            element={
              <Page>
                {isAuthed ? <Navigate to="/dashboard" replace /> : <Landing />}
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
                  <Dashboard />
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
              path="/marketplace"
              element={
                <Page>
                  <Marketplace />
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
          </Route>

          <Route path="/bikes" element={<Page><Bikes /></Page>} />
          <Route path="/bikes/:bikeId" element={<Page><BikeDetails /></Page>} />
          <Route path="/parts" element={<Page><Parts /></Page>} />
          <Route path="/builds" element={<Page><Builds /></Page>} />

          <Route path="/configurator/:bikeId" element={<Configurator />} />
          <Route path="/customize/:carId" element={<Configurator />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
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
