import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import LoginPage from "./page";
import { useAuthStore } from "@/store/authStore";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return { default: { ...actual.default, post: vi.fn(), isAxiosError: actual.default.isAxiosError } };
});
const post = vi.mocked(axios.post);

function fillAndSubmit(username = "admin", password = "Secret12345") {
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: username } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("LoginPage", () => {
  beforeEach(() => {
    push.mockReset();
    post.mockReset();
    useAuthStore.setState({ user: null });
  });
  afterEach(cleanup);

  it("signs in with credentials so the session cookies are stored, keeping only the profile", async () => {
    post.mockResolvedValueOnce({ data: { user_id: 1, username: "admin", full_name: "Admin", role: "admin", mfa_enabled: false } });
    render(<LoginPage />);
    fillAndSubmit();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe("http://api.test/api/auth/login");
    expect(String(body)).toContain("username=admin");
    expect(config).toMatchObject({ withCredentials: true });
    expect(useAuthStore.getState().user).toEqual({
      user_id: 1, username: "admin", full_name: "Admin", role: "admin", mfa_enabled: false,
    });
    expect(JSON.stringify(useAuthStore.getState().user)).not.toContain("token");
  });

  it("asks for the authenticator code when MFA is enabled, then completes sign-in", async () => {
    post
      .mockResolvedValueOnce({ data: { user_id: 1, username: "admin", role: "admin", mfa_required: true, mfa_token: "mfa-jwt" } })
      .mockResolvedValueOnce({ data: { user_id: 1, username: "admin", role: "admin", mfa_enabled: true } });
    render(<LoginPage />);
    fillAndSubmit();

    const codeInput = await screen.findByLabelText("Authentication code");
    expect(push).not.toHaveBeenCalled();
    fireEvent.change(codeInput, { target: { value: " 123456 " } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(post.mock.calls[1][0]).toBe("http://api.test/api/auth/mfa/verify");
    expect(post.mock.calls[1][1]).toEqual({ mfa_token: "mfa-jwt", code: "123456" });
    expect(post.mock.calls[1][2]).toMatchObject({ withCredentials: true });
  });

  it("shows the server's error message for bad credentials", async () => {
    post.mockRejectedValueOnce(Object.assign(new axios.AxiosError("Unauthorized"), {
      response: { status: 401, data: { detail: "Incorrect username or password" } },
    }));
    render(<LoginPage />);
    fillAndSubmit("admin", "wrong");

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Incorrect username or password");
    expect(push).not.toHaveBeenCalled();
  });

  it("explains when the API cannot be reached", async () => {
    post.mockRejectedValueOnce(new axios.AxiosError("Network Error"));
    render(<LoginPage />);
    fillAndSubmit();
    expect((await screen.findByRole("alert")).textContent).toContain("Cannot reach the server");
  });
});
