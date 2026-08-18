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
        <Route path="/" element={<Navigate to="/feed" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/profiles" element={<PublicProfilePage />} />
        <Route
          path="/profile/me"
          element={
            <ProtectedRoute>
              <MyProfilePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/feed" replace />} />
        </Routes>
        <Routes>
        {/* Current user profile */}
        <Route path="/profile" element={<MyProfilePage />} />
        
        {/* Any user profile via username search */}
        <Route path="/profile/:username" element={<UserProfilePage />} />
      </Routes>
    </AppLayout>
  );
}