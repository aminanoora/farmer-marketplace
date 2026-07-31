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
const mockLoginFn = vi.hoisted(() => vi.fn());
const mockShowError = vi.hoisted(() => vi.fn());
const mockShowSuccess = vi.hoisted(() => vi.fn());
const mockAuthLogin = vi.hoisted(() => vi.fn());

vi.mock("next/image", () => ({
  default: ({ fill: _f, priority: _p, ...props }: any) => createElement("img", props),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ login: mockLoginFn }),
}));

vi.mock("@/lib/notification-context", () => ({
  useNotification: () => ({
    showError: mockShowError,
    showSuccess: mockShowSuccess,
  }),
}));

vi.mock("@/lib/api", () => ({
  authAPI: {
    login: mockAuthLogin,
  },
}));

vi.mock("@/components/forgot-password-modal", () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen
      ? createElement(
          "div",
          { "data-testid": "forgot-password-modal" },
          createElement("span", null, "Forgot Password Modal"),
          createElement("button", {
            onClick: onClose,
            "data-testid": "close-forgot-modal",
          }, "Close")
        )
      : null,
}));

// ──────────────────────────────────────────────────
// Import component (after mocks)
// ──────────────────────────────────────────────────
import LoginPage from "../page";

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────
function renderPage() {
  return render(createElement(LoginPage));
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  email = "user@test.com",
  password = "password123"
) {
  await user.type(screen.getByLabelText(/email/i), email);
  await user.type(screen.getByLabelText(/^password/i), password);
}

async function submitForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /sign in/i }));
}

// ──────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────
describe("User Login Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ───── Render & Elements ─────
  describe("rendering", () => {
    it("renders the login form with all essential elements", () => {
      renderPage();

      // Form fields
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();

      // Submit button
      expect(
        screen.getByRole("button", { name: /sign in/i })
      ).toBeInTheDocument();

      // Remember me
      expect(screen.getByLabelText(/remember me/i)).toBeInTheDocument();

      // Forgot password button
      expect(
        screen.getByRole("button", { name: /forgot password/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /create one/i })
      ).toBeInTheDocument();
    });

    it("renders the welcome header and brand elements", () => {
      renderPage();
      expect(
        screen.getByRole("heading", { name: /^welcome back$/i })
      ).toBeInTheDocument();
      // Krishi Market appears in both the desktop sidebar (h1) and mobile logo (span)
      const brandElements = screen.getAllByText(/krishi market/i);
      expect(brandElements.length).toBeGreaterThanOrEqual(1);
      // At least one is visible (both are in the DOM, one hidden via CSS in prod)
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
      await user.type(screen.getByLabelText(/email/i), "notanemail");
      await user.type(screen.getByLabelText(/^password/i), "password123");
      await submitForm(user);

      expect(
        screen.getByText(/please enter a valid email/i)
      ).toBeInTheDocument();
    });

    it("shows error for password shorter than 6 characters", async () => {
      const user = userEvent.setup();
      renderPage();
      await user.type(screen.getByLabelText(/email/i), "test@test.com");
      await user.type(screen.getByLabelText(/^password/i), "abc");
      await submitForm(user);

      expect(
        screen.getByText(/password must be at least 6 characters/i)
      ).toBeInTheDocument();
    });

    it("clears field error when user starts typing in the field", async () => {
      const user = userEvent.setup();
      renderPage();

      // Submit empty to trigger errors
      await submitForm(user);
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();

      // Start typing email — email error should disappear
      await user.type(screen.getByLabelText(/email/i), "a");
      expect(screen.queryByText(/email is required/i)).not.toBeInTheDocument();

      // Start typing password — password error should disappear
      await user.type(screen.getByLabelText(/^password/i), "x");
      expect(
        screen.queryByText(/password is required/i)
      ).not.toBeInTheDocument();
    });

    it("validates email on blur", async () => {
      const user = userEvent.setup();
      renderPage();

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, "bad");
      // Click password field to trigger blur on email
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
      // Click email field to trigger blur on password
      await user.click(screen.getByLabelText(/email/i));

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
  describe("successful login", () => {
    const mockUser = {
      _id: "123",
      name: "Test User",
      email: "user@test.com",
      role: "consumer" as const,
    };
    const mockToken = "mock-jwt-token";

    beforeEach(() => {
      mockAuthLogin.mockResolvedValue({
        data: { token: mockToken, user: mockUser },
      });
    });

    it("calls authAPI.login with correct credentials", async () => {
      const user = userEvent.setup();
      renderPage();
      await fillForm(user, "test@test.com", "secret123");
      await submitForm(user);

      expect(mockAuthLogin).toHaveBeenCalledWith({
        email: "test@test.com",
        password: "secret123",
      });
    });

    it("calls useAuth().login with token and user on success", async () => {
      const user = userEvent.setup();
      renderPage();
      await fillForm(user, "test@test.com", "secret123");
      await submitForm(user);

      await waitFor(() => {
        expect(mockLoginFn).toHaveBeenCalledWith(mockToken, mockUser);
      });
    });

    it("shows success notification on successful login", async () => {
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

    it("navigates to home page after successful login", async () => {
      const user = userEvent.setup();
      renderPage();
      await fillForm(user);
      await submitForm(user);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/");
      });
    });
  });

  // ───── Failed Login ─────
  describe("failed login", () => {
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

    it("shows error banner when login API returns an error", async () => {
      mockAuthLogin.mockRejectedValue(
        createApiError(401, "Invalid email or password.")
      );

      const user = userEvent.setup();
      renderPage();
      await fillForm(user);
      await submitForm(user);

      await waitFor(() => {
        expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
      });
    });

    it("calls showError notification on login failure", async () => {
      mockAuthLogin.mockRejectedValue(
        createApiError(401, "Invalid email or password.")
      );

      const user = userEvent.setup();
      renderPage();
      await fillForm(user);
      await submitForm(user);

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith(
          "Invalid email or password."
        );
      });
    });

    it("dismisses error banner when close button is clicked", async () => {
      mockAuthLogin.mockRejectedValue(
        createApiError(500, "Server error")
      );

      const user = userEvent.setup();
      renderPage();
      await fillForm(user);
      await submitForm(user);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });

      // The error banner's close button has accessible name "close" from its child span
      const dismissBtn = screen.getByRole("button", { name: /close/i });
      await user.click(dismissBtn);
      expect(screen.queryByText(/server error/i)).not.toBeInTheDocument();
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
      mockAuthLogin.mockRejectedValue(error);

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
      // Never resolve — keep loading forever
      mockAuthLogin.mockImplementation(() => new Promise(() => {}));

      const user = userEvent.setup();
      renderPage();
      await fillForm(user);
      await submitForm(user);

      // Button should be disabled with spinner text
      const submitBtn = screen.getByRole("button", { name: /signing in/i });
      expect(submitBtn).toBeDisabled();
      expect(
        screen.getByText(/signing in/i)
      ).toBeInTheDocument();
    });
  });

  // ───── Forgot Password Modal ─────
  describe("forgot password modal", () => {
    it("opens forgot password modal when clicking the link", async () => {
      const user = userEvent.setup();
      renderPage();

      // Click "Forgot password?" button
      await user.click(screen.getByRole("button", { name: /forgot password/i }));

      expect(
        screen.getByTestId("forgot-password-modal")
      ).toBeInTheDocument();
    });

    it("closes forgot password modal when close is clicked", async () => {
      const user = userEvent.setup();
      renderPage();

      // Open modal
      await user.click(screen.getByRole("button", { name: /forgot password/i }));
      expect(
        screen.getByTestId("forgot-password-modal")
      ).toBeInTheDocument();

      // Close modal
      await user.click(screen.getByTestId("close-forgot-modal"));
      expect(
        screen.queryByTestId("forgot-password-modal")
      ).not.toBeInTheDocument();
    });
  });
});
