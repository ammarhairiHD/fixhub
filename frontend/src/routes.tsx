import { createBrowserRouter } from "react-router-dom";
import {
  PublicOnly,
  RequireAuth,
  RequireRole,
  RoleHomeRedirect,
} from "./components/AuthGuard";
import { AppLayout } from "./components/AppLayout";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";
import { HealthPage } from "./pages/HealthPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { RoleHomePage } from "./pages/RoleHomePage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        path: "login",
        element: (
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        ),
      },
      {
        path: "register",
        element: (
          <PublicOnly>
            <RegisterPage />
          </PublicOnly>
        ),
      },
      {
        path: "health",
        element: <HealthPage />,
      },
      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <RoleHomeRedirect /> },
          { path: "change-password", element: <ChangePasswordPage /> },
          {
            path: "requests",
            element: (
              <RequireRole role="REPORTER">
                <RoleHomePage role="REPORTER" />
              </RequireRole>
            ),
          },
          {
            path: "dashboard",
            element: (
              <RequireRole role="ADMIN">
                <RoleHomePage role="ADMIN" />
              </RequireRole>
            ),
          },
          {
            path: "jobs",
            element: (
              <RequireRole role="TECHNICIAN">
                <RoleHomePage role="TECHNICIAN" />
              </RequireRole>
            ),
          },
        ],
      },
    ],
  },
]);
