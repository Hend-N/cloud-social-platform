import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { ProtectedRoute } from "./auth/ProtectedRoute";

import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { FeedPage } from "./pages/FeedPage";
import { MyProfilePage } from "./pages/MyProfilePage";
import { PublicProfilePage } from "./pages/PublicProfilePage";
import { UserProfilePage } from "./pages/UserProfilePage";

export default function App() {
  return (
    <AppLayout>
      <Routes>
        {/* Core Pages */}
        <Route path="/" element={<Navigate to="/feed" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/profiles" element={<PublicProfilePage />} />

        {/* Profile Routes */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <MyProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/me"
          element={
            <ProtectedRoute>
              <MyProfilePage />
            </ProtectedRoute>
          }
        />
        <Route path="/profile/:username" element={<UserProfilePage />} />

        {/* Wildcard Fallback */}
        <Route path="*" element={<Navigate to="/feed" replace />} />
      </Routes>
    </AppLayout>
  );
}