import { AnimatePresence, motion } from 'framer-motion';
import { Component, useEffect, useRef, useState } from 'react';
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
import AdminAnchorEditor from './pages/AdminAnchorEditor.jsx';
import AdminSecurity from './pages/AdminSecurity.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Custom from './pages/Custom.jsx';
import Marketplace from './pages/Marketplace.jsx';
import Advisor from './pages/Advisor.jsx';
import Profile from './pages/Profile.jsx';
import SearchResults from './pages/SearchResults.jsx';
import Shop from './pages/Shop.jsx';
import Following from './pages/Following.jsx';
import Notifications from './pages/Notifications.jsx';
import Orders from './pages/Orders.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import SellerCenter from './pages/seller/SellerCenter.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import { useAuth } from './services/auth/AuthContext.jsx';
import { LanguageProvider } from './services/i18n.jsx';
import AiAssistant from './components/AiAssistant.jsx';

const FullscreenError = ({ title, message, detail, onRetry }) => {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-12">
        <div className="w-full overflow-hidden rounded-3xl border border-white/10 bg-black/30 shadow-2xl shadow-black/60 backdrop-blur-2xl">
          <div className="border-b border-white/10 px-6 py-5">
            <div className="text-xs font-semibold tracking-[0.22em] text-rose-300/90">CARBANANA</div>
            <div className="mt-2 text-2xl font-black tracking-tight text-zinc-50">{title}</div>
            <div className="mt-1 text-sm text-zinc-300">{message}</div>
          </div>
          <div className="space-y-4 px-6 py-5">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10"
              >
                Tải lại trang
              </button>
              <button
                type="button"
                onClick={onRetry}
                className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-black text-zinc-950 hover:bg-emerald-300"
              >
                Thử lại
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    const err = this.state?.error;
    if (err) {
      const msg = String(err?.message || '').trim() || 'Ứng dụng gặp lỗi không mong muốn.';
      const stack = String(err?.stack || '').trim();
      return (
        <FullscreenError
          title="Ứng dụng gặp lỗi"
          message="Vui lòng tải lại trang. Nếu vẫn gặp, hãy thử lại sau ít phút."
          detail={[msg, stack].filter(Boolean).join('\n\n')}
          onRetry={() => window.location.reload()}
        />
      );
    }
    return this.props.children;
  }
}

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
  const isVendor = isAuthed && role === 'VENDOR' && !user?.isAdmin;
  const vendorMode = (() => {
    if (!isVendor) return 'user';
    try {
      const v = String(localStorage.getItem('carbanana.vendor.mode') || '').trim().toLowerCase();
      return v === 'user' ? 'user' : 'seller';
    } catch {
      return 'seller';
    }
  })();
  const [fatal, setFatal] = useState(null);
  const lastFatalRef = useRef({ key: '', at: 0 });

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

  useEffect(() => {
    if (!isVendor) return;
    if (vendorMode !== 'seller') return;
    const path = String(location?.pathname || '');
    if (!path) return;
    const allow =
      path === '/' ||
      path === '/login' ||
      path === '/register' ||
      path === '/forgot-password' ||
      path === '/reset-password' ||
      path === '/reset-by-code' ||
      path === '/auth/callback' ||
      path.startsWith('/seller-center');
    if (allow) return;
    navigate('/seller-center', { replace: true });
  }, [isVendor, location?.pathname, navigate, vendorMode]);

  useEffect(() => {
    const setFatalSafe = (next) => {
      const key = String(next?.kind || '') + '|' + String(next?.status || '') + '|' + String(next?.path || '') + '|' + String(next?.message || '');
      const now = Date.now();
      if (key && lastFatalRef.current.key === key && now - lastFatalRef.current.at < 2500) return;
      lastFatalRef.current = { key, at: now };
      setFatal(next);
    };

    const onApiError = (ev) => {
      const d = ev?.detail && typeof ev.detail === 'object' ? ev.detail : {};
      const kind = String(d?.kind || '').trim();
      const status = Number(d?.status) || 0;
      if (!kind) return;
      setFatalSafe({
        kind,
        status,
        path: String(d?.path || ''),
        base: String(d?.base || ''),
        message: String(d?.message || '')
      });
    };

    const onOffline = () => setFatalSafe({ kind: 'offline', status: 0, path: '', base: '', message: '' });
    const onUnhandled = (ev) => {
      const reason = ev?.reason;
      const msg = String(reason?.message || reason || '').trim();
      if (!msg) return;
      setFatalSafe({ kind: 'runtime', status: 0, path: '', base: '', message: msg });
    };
    const onError = (ev) => {
      const msg = String(ev?.message || '').trim();
      if (!msg) return;
      setFatalSafe({ kind: 'runtime', status: 0, path: '', base: '', message: msg });
    };

    try {
      if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) onOffline();
    } catch {}

    window.addEventListener('carbanana:api-error', onApiError);
    window.addEventListener('offline', onOffline);
    window.addEventListener('unhandledrejection', onUnhandled);
    window.addEventListener('error', onError);
    return () => {
      window.removeEventListener('carbanana:api-error', onApiError);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('unhandledrejection', onUnhandled);
      window.removeEventListener('error', onError);
    };
  }, []);

  if (fatal) {
    const kind = String(fatal?.kind || '').trim();
    const status = Number(fatal?.status) || 0;
    const path = String(fatal?.path || '').trim();
    const base = String(fatal?.base || '').trim();
    const msg = String(fatal?.message || '').trim();
    const title =
      kind === 'offline'
        ? 'Mất kết nối mạng'
        : kind === 'network'
          ? 'Không thể kết nối máy chủ'
          : kind === 'server'
            ? 'Máy chủ đang gặp sự cố'
            : 'Đã xảy ra lỗi';
    const message =
      kind === 'offline'
        ? 'Thiết bị của bạn đang offline. Vui lòng kiểm tra mạng rồi thử lại.'
        : kind === 'network'
          ? 'Không thể kết nối tới máy chủ. Vui lòng thử lại sau.'
          : kind === 'server'
            ? 'Hệ thống đang lỗi hoặc quá tải. Vui lòng thử lại sau.'
            : 'Ứng dụng gặp lỗi không mong muốn. Vui lòng thử lại.';
    const detail = [
      msg ? `Mã lỗi: ${msg}` : '',
      status ? `HTTP: ${status}` : '',
      path ? `API: ${path}` : '',
      base ? `Server: ${base}` : ''
    ]
      .filter(Boolean)
      .join('\n');
    return (
      <FullscreenError
        title={title}
        message={message}
        detail={detail}
        onRetry={() => {
          try {
            localStorage.removeItem('carbanana.apiBase');
          } catch {}
          setFatal(null);
          window.location.reload();
        }}
      />
    );
  }

  return (
    <div className={isConfigurator ? 'min-h-screen bg-zinc-950 text-zinc-100' : 'min-h-screen bg-zinc-950 text-zinc-100'}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route
            path="/"
            element={
              <Page>
                {isAuthed ? <Navigate to={isVendor && vendorMode !== 'user' ? '/seller-center' : '/dashboard'} replace /> : <Landing />}
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
                  {isVendor && vendorMode !== 'user' ? <Navigate to="/seller-center" replace /> : <Dashboard />}
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
              path="/shops/:vendorId"
              element={
                <Page>
                  <Marketplace />
                </Page>
              }
            />
            <Route path="/bikes" element={<Page><Bikes /></Page>} />
            <Route path="/bikes/:bikeId" element={<Page><BikeDetails /></Page>} />
            <Route path="/parts" element={<Page><Parts /></Page>} />
            <Route path="/builds" element={<Page><Builds /></Page>} />
            <Route path="/builds/:id" element={<Page><BuildDetail /></Page>} />
            <Route path="/leaderboard" element={<Page><Leaderboard /></Page>} />
            <Route path="/booking/:id" element={<Page><BookingStatus /></Page>} />
            <Route
              path="/seller-center"
              element={
                <Page>
                  <SellerCenter />
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
              path="/orders"
              element={
                <Page>
                  <Orders />
                </Page>
              }
            />
            <Route
              path="/orders/:id"
              element={
                <Page>
                  <OrderDetail />
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
              path="/following"
              element={
                <Page>
                  <Following />
                </Page>
              }
            />
            <Route
              path="/notifications"
              element={
                <Page>
                  <Notifications />
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
              path="/admin/anchors/:carId"
              element={
                <RequireAdmin>
                  <Page>
                    <AdminAnchorEditor />
                  </Page>
                </RequireAdmin>
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
            <Route
              path="/admin/security"
              element={
                <RequireAdmin>
                  <Page>
                    <AdminSecurity />
                  </Page>
                </RequireAdmin>
              }
            />
          </Route>

          <Route path="/configurator/:bikeId" element={<Configurator />} />
          <Route path="/customize/:carId" element={<Configurator />} />

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
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </LanguageProvider>
  );
};

export default AppWithProviders;
