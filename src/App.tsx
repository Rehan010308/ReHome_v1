import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { GuestOnly, ProtectedRoute, RequireAccountType } from "@/components/auth/guards";
import { MarketingLayout } from "@/layouts/MarketingLayout";
import { AppShell } from "@/layouts/AppShell";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/auth/Login";
import Signup from "@/pages/auth/Signup";
import AccountType from "@/pages/auth/AccountType";
import AppIndex from "@/pages/app/AppIndex";
import IndividualDashboard from "@/pages/app/IndividualDashboard";
import OrganizationDashboard from "@/pages/app/OrganizationDashboard";
import ProfilePage from "@/pages/app/Profile";
import SettingsPage from "@/pages/app/Settings";
import ScanItem from "@/pages/app/ScanItem";
import Requirements from "@/pages/app/Requirements";
import Matches from "@/pages/app/Matches";
import Handoffs from "@/pages/app/Handoffs";
import Impact from "@/pages/app/Impact";

/**
 * HashRouter is used so the app can be served from GitHub Pages
 * without server-side rewrites — same strategy as the original ReHome.
 */
const App = () => (
  <AuthProvider>
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<Home />} />
          <Route
            path="/login"
            element={
              <GuestOnly>
                <Login />
              </GuestOnly>
            }
          />
          <Route
            path="/signup"
            element={
              <GuestOnly>
                <Signup />
              </GuestOnly>
            }
          />
        </Route>

        <Route
          path="/onboarding/account-type"
          element={
            <ProtectedRoute>
              <AccountType />
            </ProtectedRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/app" element={<AppIndex />} />
          <Route
            path="/app/individual"
            element={
              <RequireAccountType type="individual">
                <IndividualDashboard />
              </RequireAccountType>
            }
          />
          <Route
            path="/app/scan"
            element={
              <RequireAccountType type="individual">
                <ScanItem />
              </RequireAccountType>
            }
          />
          <Route path="/app/matches" element={<Matches />} />
          <Route path="/app/handoffs" element={<Handoffs />} />
          <Route path="/app/impact" element={<Impact />} />
          <Route
            path="/app/organization"
            element={
              <RequireAccountType type="organization">
                <OrganizationDashboard />
              </RequireAccountType>
            }
          />
          <Route
            path="/app/requirements"
            element={
              <RequireAccountType type="organization">
                <Requirements />
              </RequireAccountType>
            }
          />
          <Route path="/app/profile" element={<ProfilePage />} />
          <Route path="/app/settings" element={<SettingsPage />} />
        </Route>

        <Route element={<MarketingLayout />}>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  </AuthProvider>
);

export default App;
