import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";

// ──────────────────────────────────────────────────
// Mocks — use vi.hoisted() so variables are
// initialized before vi.mock() factories run
// ──────────────────────────────────────────────────
const mockPush = vi.hoisted(() => vi.fn());
const mockAdminLoginFn = vi.hoisted(() => vi.fn());
const mockShowError = vi.hoisted(() => vi.fn());
const mockShowSuccess = vi.hoisted(() => vi.fn());
const mockAdminAPILogin = vi.hoisted(() => vi.fn());

vi.mock("next/image", () => ({
  default: ({ fill: _f, priority: _p, ...props }: any) => createElement("img", props),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/admin-auth-context", () => ({
  useAdminAuth: () => ({ login: mockAdminLoginFn }),
}));

vi.mock("@/lib/notification-context", () => ({
  useNotification: () => ({
    showError: mockShowError,
    showSuccess: mockShowSuccess,
  }),
}));

vi.mock("@/lib/api", () => ({
  adminAPI: {
    login: mockAdminAPILogin,
  },
}));

// ──────────────────────────────────────────────────
// Import component (after mocks)
// ──────────────────────────────────────────────────
import AdminLoginPage from "../page";

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────
function renderPage() {
  return render(createElement(AdminLoginPage));
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  email = "admin@test.com",
  password = "admin123"
) {
  await user.type(screen.getByLabelText(/admin email/i), email);
  await user.type(screen.getByLabelText(/^password/i), password);
}

async function submitForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("button", { name: /sign in to admin/i })
  );
}

// ──────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────
describe("Admin Login Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ───── Rendering ─────
  describe("rendering", () => {
    it("renders the admin login form with all essential elements", () => {
      renderPage();

      // Admin-specific badge
      expect(screen.getByText(/admin portal/i)).toBeInTheDocument();

      // Form fields with admin-specific labels
      expect(screen.getByLabelText(/admin email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();

      // Submit button
      expect(
        screen.getByRole("button", { name: /sign in to admin/i })
      ).toBeInTheDocument();
    });

    it("renders the admin-specific header elements", () => {
      renderPage();

      expect(screen.getByText(/admin sign in/i)).toBeInTheDocument();
      expect(
        screen.getByText(/secure access for platform administrators/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/admin dashboard/i)).toBeInTheDocument();
    });

    it("renders navigation links for users", () => {
      renderPage();

      const userLoginLink = screen.getByRole("link", { name: /user login/i });
      expect(userLoginLink).toBeInTheDocument();
      expect(userLoginLink).toHaveAttribute("href", "/auth/login");

      const backToSiteLink = screen.getByRole("link", { name: /back to site/i });
      expect(backToSiteLink).toBeInTheDocument();
      expect(backToSiteLink).toHaveAttribute("href", "/");
    });
  });

  // ───── Client-side Validation ─────
  describe("client-side validation", () => {
    it("shows validation errors when submitting empty form", async () => {
      const user = userEvent.setup();
      renderPage();
      await submitForm(user);

      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });

    it("shows error for invalid email format", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(screen.getByLabelText(/admin email/i), "bad-email");
      await user.type(screen.getByLabelText(/^password/i), "admin123");
      await submitForm(user);

      expect(
        screen.getByText(/please enter a valid email/i)
      ).toBeInTheDocument();
    });

    it("shows error for password shorter than 6 characters", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(screen.getByLabelText(/admin email/i), "admin@test.com");
      await user.type(screen.getByLabelText(/^password/i), "12");
      await submitForm(user);

      expect(
        screen.getByText(/password must be at least 6 characters/i)
      ).toBeInTheDocument();
    });

    it("clears field errors when user starts typing", async () => {
      const user = userEvent.setup();
      renderPage();

      await submitForm(user);
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();

      await user.type(screen.getByLabelText(/admin email/i), "a");
      expect(
        screen.queryByText(/email is required/i)
      ).not.toBeInTheDocument();

      await user.type(screen.getByLabelText(/^password/i), "x");
      expect(
        screen.queryByText(/password is required/i)
      ).not.toBeInTheDocument();
    });

    it("validates email on blur", async () => {
      const user = userEvent.setup();
      renderPage();

      const emailInput = screen.getByLabelText(/admin email/i);
      await user.type(emailInput, "bad");
      await user.click(screen.getByLabelText(/^password/i));

      expect(
        screen.getByText(/please enter a valid email/i)
      ).toBeInTheDocument();
    });

    it("validates password on blur", async () => {
      const user = userEvent.setup();
      renderPage();

      const passwordInput = screen.getByLabelText(/^password/i);
      await user.type(passwordInput, "12");
      await user.click(screen.getByLabelText(/admin email/i));

      expect(
        screen.getByText(/password must be at least 6 characters/i)
      ).toBeInTheDocument();
    });
  });

  // ───── Password Visibility Toggle ─────
  describe("password visibility toggle", () => {
    it("toggles password field type between password and text", async () => {
      const user = userEvent.setup();
      renderPage();

      const passwordInput = screen.getByLabelText(/^password/i);
      const toggleBtn = screen.getByRole("button", { name: /show password/i });

      expect(passwordInput).toHaveAttribute("type", "password");

      await user.click(toggleBtn);
      expect(passwordInput).toHaveAttribute("type", "text");

      await user.click(
        screen.getByRole("button", { name: /hide password/i })
      );
      expect(passwordInput).toHaveAttribute("type", "password");
    });
  });

  // ───── Successful Login ─────
  describe("successful admin login", () => {
    const mockAdminUser = {
      _id: "admin1",
      name: "Admin User",
      email: "admin@test.com",
      role: "admin" as const,
    };
    const mockToken = "mock-admin-jwt";

    beforeEach(() => {
      mockAdminAPILogin.mockResolvedValue({
        data: { token: mockToken, user: mockAdminUser },
      });
    });

    it("calls adminAPI.login with correct credentials", async () => {
      const user = userEvent.setup();
      renderPage();
      await fillForm(user, "admin@test.com", "admin123");
      await submitForm(user);

      expect(mockAdminAPILogin).toHaveBeenCalledWith({
        email: "admin@test.com",
        password: "admin123",
      });
    });

    it("calls useAdminAuth().login with token and user on success", async () => {
      const user = userEvent.setup();
      renderPage();
      await fillForm(user, "admin@test.com", "admin123");
      await submitForm(user);

      await waitFor(() => {
        expect(mockAdminLoginFn).toHaveBeenCalledWith(
          mockToken,
          mockAdminUser
        );
      });
    });

    it("shows success notification on successful admin login", async () => {
      const user = userEvent.setup();
      renderPage();
      await fillForm(user);
      await submitForm(user);

      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith(
          expect.stringContaining("Welcome back")
        );
      });
    });

    it("navigates to admin dashboard after successful login", async () => {
      const user = userEvent.setup();
      renderPage();
      await fillForm(user);
      await submitForm(user);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/admin/dashboard");
      });
    });
  });

  // ───── Failed Login ─────
  describe("failed admin login", () => {
    function createApiError(status: number, message: string) {
      const error = new AxiosError();
      error.response = {
        status,
        data: { message },
        statusText: "Error",
        headers: new AxiosHeaders(),
        config: {} as any,
      };
      return error;
    }

    it("shows error banner when admin login API returns an error", async () => {
      mockAdminAPILogin.mockRejectedValue(
        createApiError(401, "Invalid admin credentials.")
      );

      const user = userEvent.setup();
      renderPage();
      await fillForm(user);
      await submitForm(user);

      await waitFor(() => {
        expect(
          screen.getByText(/invalid admin credentials/i)
        ).toBeInTheDocument();
      });
    });

    it("calls showError notification on login failure", async () => {
      mockAdminAPILogin.mockRejectedValue(
        createApiError(403, "Access denied. Admin privileges required.")
      );

      const user = userEvent.setup();
      renderPage();
      await fillForm(user);
      await submitForm(user);

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith(
          "Access denied. Admin privileges required."
        );
      });
    });

    it("shows generic error message when API returns no specific message", async () => {
      const error = new AxiosError();
      error.response = {
        status: 500,
        data: {},
        statusText: "Error",
        headers: new AxiosHeaders(),
        config: {} as any,
      };
      mockAdminAPILogin.mockRejectedValue(error);

      const user = userEvent.setup();
      renderPage();
      await fillForm(user);
      await submitForm(user);

      await waitFor(() => {
        expect(
          screen.getByText(/login failed/i)
        ).toBeInTheDocument();
      });
    });
  });

  // ───── Loading State ─────
  describe("loading state", () => {
    it("shows spinner and disabled button while submitting", async () => {
      mockAdminAPILogin.mockImplementation(() => new Promise(() => {}));

      const user = userEvent.setup();
      renderPage();
      await fillForm(user);
      await submitForm(user);

      const submitBtn = screen.getByRole("button", {
        name: /authenticating/i,
      });
      expect(submitBtn).toBeDisabled();
      expect(screen.getByText(/authenticating/i)).toBeInTheDocument();
    });
  });
});
