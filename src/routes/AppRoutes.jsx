import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
// Home and Feed stay as regular (non-lazy) imports — they're the two pages a
// search visitor or first-time user is most likely to land on, so they
// should paint immediately with no extra network round trip. Every other
// route is lazy so the initial bundle isn't paying for admin tooling
// (RichTextEditor, etc.) or the Ludo game on a page that mostly gets hit by
// search crawlers and new visitors — see the SEO Core Web Vitals pass.
import Home from '../pages/Home/Home';
import Feed from '../pages/Feed/Feed';

const About = lazy(() => import('../pages/About/About'));
const Login = lazy(() => import('../pages/Login/Login'));
const ForgotPassword = lazy(() => import('../pages/ForgotPassword/ForgotPassword'));
const Register = lazy(() => import('../pages/Register/Register'));
const Terms = lazy(() => import('../pages/Terms/Terms'));
const Legal = lazy(() => import('../pages/Legal/Legal'));
const Privacy = lazy(() => import('../pages/Privacy/Privacy'));
const ArticlesIndex = lazy(() => import('../pages/Articles/ArticlesIndex'));
const ArticleDetail = lazy(() => import('../pages/Articles/ArticleDetail'));
const ReporterProfile = lazy(() => import('../pages/Reporters/ReporterProfile'));
const MyIssues = lazy(() => import('../pages/Issues/MyIssues'));
const IssueDetail = lazy(() => import('../pages/Issues/IssueDetail'));
const Profile = lazy(() => import('../pages/Profile/Profile'));
const AdminDashboard = lazy(() => import('../pages/Admin/AdminDashboard'));
const Ludo = lazy(() => import('../pages/Games/Ludo'));
const CustomPage = lazy(() => import('../pages/CustomPage/CustomPage'));
const FileRTIRequest = lazy(() => import('../pages/RTI/FileRTIRequest'));
const MyRTIRequests = lazy(() => import('../pages/RTI/MyRTIRequests'));
const RTIRequestDetail = lazy(() => import('../pages/RTI/RTIRequestDetail'));
const LawyerDashboard = lazy(() => import('../pages/Lawyer/LawyerDashboard'));
const LawyerProfile = lazy(() => import('../pages/Lawyer/LawyerProfile'));
const FindLawyer = lazy(() => import('../pages/Legal/FindLawyer'));
const InstallApp = lazy(() => import('../pages/InstallApp/InstallApp'));

export default function AppRoutes() {
  return (
    <Suspense fallback={null}>
    <Routes>
      {/* Public, standalone pages (each renders its own top nav) */}
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/feed" element={<Feed />} />
      <Route path="/articles" element={<ArticlesIndex />} />
      <Route path="/articles/:slug" element={<ArticleDetail />} />
      <Route path="/reporters/:id" element={<ReporterProfile />} />
      <Route path="/issues/:id" element={<ProtectedRoute><IssueDetail /></ProtectedRoute>} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/register" element={<Register />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/legal" element={<Legal />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/find-a-lawyer" element={<FindLawyer />} />
      <Route path="/install" element={<InstallApp />} />
      {/* Super Admin-created standalone pages (models/CustomPage.js) — kept
          under /p/ rather than a bare /:slug so it can never collide with a
          route added above/below later. Must stay after every fixed route
          above and before the catch-all below. */}
      <Route path="/p/:slug" element={<CustomPage />} />

      {/* Authenticated app shell */}
      <Route element={<Layout />}>
        <Route path="/my-issues" element={<ProtectedRoute><MyIssues /></ProtectedRoute>} />
        <Route path="/games" element={<ProtectedRoute><Ludo /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route
          path="/admin"
          element={<ProtectedRoute role="Admin"><AdminDashboard /></ProtectedRoute>}
        />
        <Route
          path="/author"
          element={<ProtectedRoute role="Authority"><AdminDashboard /></ProtectedRoute>}
        />
        <Route
          path="/lawyer"
          element={<ProtectedRoute roles={['Lawyer', 'Admin']}><LawyerDashboard /></ProtectedRoute>}
        />
        <Route
          path="/lawyer/profile"
          element={<ProtectedRoute roles={['Lawyer', 'Admin']}><LawyerProfile /></ProtectedRoute>}
        />
        <Route path="/rti/new" element={<ProtectedRoute><FileRTIRequest /></ProtectedRoute>} />
        <Route path="/rti/mine" element={<ProtectedRoute><MyRTIRequests /></ProtectedRoute>} />
        <Route path="/rti/:id" element={<ProtectedRoute><RTIRequestDetail /></ProtectedRoute>} />
      </Route>

      <Route path="/report" element={<Navigate to="/feed" replace />} />
      <Route path="/dashboard" element={<Navigate to="/feed" replace />} />
      {/* Founder's Message merged into About — keep the old URL alive for
          existing bookmarks/links/search results instead of a dead 404. */}
      <Route path="/founders-message" element={<Navigate to="/about" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
