import { BrowserRouter, Link, Route, Routes, useNavigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { FeedPage } from "./pages/FeedPage";
import { MyProfilePage } from "./pages/MyProfilePage";
import { PublicProfilePage } from "./pages/PublicProfilePage";

function Navigation() {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem("access_token");
    navigate("/login");
  }

  return (
    <nav style={{ marginBottom: "24px" }}>
      <Link to="/login">Login</Link>{" | "}
      <Link to="/register">Register</Link>{" | "}
      <Link to="/feed">Feed</Link>{" | "}
      <Link to="/profile/me">My Profile</Link>{" | "}
<Link to="/profiles">Find Profile</Link>{" | "}
      <button onClick={handleLogout}>Logout</button>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <main style={{ padding: "40px", color: "white" }}>
        <h1>Cloud Social Platform</h1>

        <Navigation />

        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/profile/me" element={<MyProfilePage />} />
          <Route path="/profiles" element={<PublicProfilePage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;