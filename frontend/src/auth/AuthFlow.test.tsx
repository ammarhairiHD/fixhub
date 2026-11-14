import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UserRole } from "@shared/enums";
import { AuthProvider } from "./AuthContext";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { ChangePasswordPage } from "../pages/ChangePasswordPage";
import { RoleHomePage } from "../pages/RoleHomePage";
import {
  RequireAuth,
  RequireRole,
  RoleHomeRedirect,
} from "../components/AuthGuard";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("UC-01 authentication pages", () => {
  it.each([
    ["REPORTER", "My requests"],
    ["ADMIN", "Dashboard"],
    ["TECHNICIAN", "My jobs"],
  ] as const)("fr03: sends %s to %s after auth check", async (role, heading) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          user: {
            id: "test-user",
            fullName: "Test User",
            email: "test@uitm.edu.my",
            role,
            mustChangePassword: false,
          },
        }),
      ),
    );
    const home = (requiredRole: UserRole) => (
      <RequireRole role={requiredRole}>
        <RoleHomePage role={requiredRole} />
      </RequireRole>
    );

    render(
      <AuthProvider>
        <MemoryRouter
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
          initialEntries={["/"]}
        >
          <Routes>
            <Route path="/" element={<RequireAuth />}>
              <Route index element={<RoleHomeRedirect />} />
              <Route path="requests" element={home("REPORTER")} />
              <Route path="dashboard" element={home("ADMIN")} />
              <Route path="jobs" element={home("TECHNICIAN")} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
  });

  it("fr03: displays the generic login error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === "POST"
          ? Promise.resolve(response({ error: "Incorrect email or password" }, 401))
          : Promise.resolve(response({ error: "Unauthorized" }, 401)),
      ),
    );
    render(
      <AuthProvider>
        <MemoryRouter
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
          initialEntries={["/login"]}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );
    fireEvent.change(screen.getByLabelText("UiTM email"), {
      target: { value: "unknown@uitm.edu.my" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("Incorrect email or password"),
    ).toBeInTheDocument();
  });

  it("fr01/fr02: renders registration field errors without clearing input", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === "POST"
          ? Promise.resolve(
              response(
                {
                  errors: {
                    email: ["Use a UiTM email address"],
                    password: ["Password must be at least 8 characters"],
                  },
                },
                400,
              ),
            )
          : Promise.resolve(response({ error: "Unauthorized" }, 401)),
      ),
    );
    render(
      <AuthProvider>
        <MemoryRouter
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
          initialEntries={["/register"]}
        >
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Sample Reporter" },
    });
    fireEvent.change(screen.getByLabelText("UiTM email"), {
      target: { value: "reporter@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Use a UiTM email address")).toBeInTheDocument();
    expect(
      screen.getByLabelText("UiTM email"),
    ).toHaveValue("reporter@example.com");
  });

  it("fr48: sends staff to their role home after changing the temporary password", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === "POST"
          ? Promise.resolve(response({ message: "Password changed successfully" }))
          : Promise.resolve(
              response({
                user: {
                  id: "staff-user",
                  fullName: "Staff User",
                  email: "staff@uitm.edu.my",
                  role: "ADMIN",
                  mustChangePassword: true,
                },
              }),
            ),
      ),
    );

    render(
      <AuthProvider>
        <MemoryRouter
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
          initialEntries={["/change-password"]}
        >
          <Routes>
            <Route path="/change-password" element={<ChangePasswordPage />} />
            <Route path="/dashboard" element={<h1>Dashboard</h1>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );
    expect(
      await screen.findByText("Change your temporary password to continue."),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "Password123" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "NewPassword456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });
});
