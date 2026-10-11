import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { AppLayout } from "../components/layout/AppLayout";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { FeedPage } from "../pages/FeedPage";
import { MyProfilePage } from "../pages/MyProfilePage";
import { MyPostsPage } from "../pages/MyPostsPage";
import { ProfilePage } from "../pages/ProfilePage";
import { DiscoverPage } from "../pages/DiscoverPage";
import { NotFoundPage } from "../pages/NotFoundPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/feed" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/feed"
        element={
          <ProtectedRoute>
            <AppLayout>
              <FeedPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profiles"
        element={
          <AppLayout>
            <DiscoverPage />
          </AppLayout>
        }
      />
      <Route
        path="/my-posts"
        element={
          <ProtectedRoute>
            <AppLayout>
              <MyPostsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/me"
        element={
          <ProtectedRoute>
            <AppLayout>
              <MyProfilePage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/:username"
        element={
          <AppLayout>
            <ProfilePage />
          </AppLayout>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
