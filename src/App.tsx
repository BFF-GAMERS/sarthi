import { Route, Routes, useLocation } from "react-router-dom";
import Header from "./components/Header";
import SarthiLauncher from "./components/SarthiLauncher";
import RequireAuth from "./components/RequireAuth";
import LandingPage from "./pages/LandingPage";
import RoleLogin from "./pages/RoleLogin";
import Dashboard from "./pages/Dashboard";
import Learn from "./pages/Learn";
import Sarthi from "./pages/Sarthi";
import Rewards from "./pages/Rewards";
import DesignPage from "./pages/DesignPage";
import Planner from "./pages/Planner";
import Admin from "./pages/Admin";
import Profile from "./pages/Profile";
import { CourseCatalog, CourseDetail } from "./pages/Courses";
import CoursePlayer from "./pages/CoursePlayer";
import NotFound from "./pages/NotFound";

export default function App() {
  const location = useLocation();
  const isAuthPage = location.pathname === "/login";
  return (
    <>
      <a
        href="#main-content"
        className="btn-primary sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60]"
      >
        Skip to content
      </a>
      {!isAuthPage && <Header />}
      {!isAuthPage && <SarthiLauncher />}
      <main id="main-content" tabIndex={-1} className="outline-none">
      <div className="page-fade" key={location.pathname}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<RoleLogin />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/learn"
          element={
            <RequireAuth>
              <Learn />
            </RequireAuth>
          }
        />
        <Route
          path="/sarthi"
          element={
            <RequireAuth>
              <Sarthi />
            </RequireAuth>
          }
        />
        <Route
          path="/rewards"
          element={
            <RequireAuth>
              <Rewards />
            </RequireAuth>
          }
        />
        <Route
          path="/planner"
          element={
            <RequireAuth>
              <Planner />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <Profile />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <Admin />
            </RequireAuth>
          }
        />
        <Route path="/courses" element={<CourseCatalog />} />
        <Route path="/courses/:classLevel/:subjectId" element={<CourseDetail />} />
        <Route
          path="/courses/:classLevel/:subjectId/learn"
          element={
            <RequireAuth>
              <CoursePlayer />
            </RequireAuth>
          }
        />
        <Route path="/design" element={<DesignPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </div>
      </main>
    </>
  );
}
