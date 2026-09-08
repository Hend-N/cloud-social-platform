import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { FeedPage } from "../pages/FeedPage";
import { MyProfilePage } from "../pages/MyProfilePage";
import { ProfilePage } from "../pages/ProfilePage";
import { DiscoverPage } from "../pages/DiscoverPage";
import { NotFoundPage } from "../pages/NotFoundPage";
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/feed" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/feed" element={<FeedPage />} />
      <Route path="/profiles" element={<DiscoverPage />} />
      <Route
        path="/profile/me"
        element={
          <ProtectedRoute>
            <MyProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <MyProfilePage />
          </ProtectedRoute>
        }
      />
      <Route path="/profile/:username" element={<ProfilePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
