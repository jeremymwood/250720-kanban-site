// Login.tsx
import { useState } from "react";
import { login, register, resendVerificationCode, verifyEmailCode } from "../lib/api";
import type { User } from "../../src/types";

type LoginProps = {
  onLogin: (token: string, user: User) => void;
};

export default function Login({ onLogin }: LoginProps) {
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState(
    import.meta.env.DEV || isDemoMode ? "alex" : ""
  );
  const [email, setEmail] = useState(
    import.meta.env.DEV || isDemoMode ? "alex@example.com" : ""
  );
  const [password, setPassword] = useState(
    import.meta.env.DEV || isDemoMode ? "Password123" : ""
  );
  const [loading, setLoading] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingVerificationUsername, setPendingVerificationUsername] = useState("");
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [showRegistrationNotice, setShowRegistrationNotice] = useState(false);
  const [registrationNoticeMessage, setRegistrationNoticeMessage] = useState("");
  const [showAuthError, setShowAuthError] = useState(false);
  const [authErrorTitle, setAuthErrorTitle] = useState("");
  const [authErrorMessage, setAuthErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      if (awaitingVerification) {
        await verifyEmailCode(pendingVerificationUsername, verificationCode);
        setAwaitingVerification(false);
        setIsRegistering(false);
        setVerificationCode("");
        setRegistrationNoticeMessage("Email verified. You can now log in after admin approval.");
        setShowRegistrationNotice(true);
        window.setTimeout(() => setShowRegistrationNotice(false), 5000);
        return;
      }

      if (isRegistering) {
        const registerResult = await register(name, username, email, password);
        const normalizedUsername = username.trim().toLowerCase();
        const normalizedEmail = email.trim().toLowerCase();

        setPendingVerificationUsername(normalizedUsername);
        setPendingVerificationEmail(normalizedEmail);
        setAwaitingVerification(Boolean(registerResult?.verificationRequired));
        setIsRegistering(Boolean(registerResult?.verificationRequired));
        setShowRegistrationNotice(true);
        setRegistrationNoticeMessage(
          registerResult?.message || "Registration received. Check your email for a verification code."
        );
        window.setTimeout(() => setShowRegistrationNotice(false), 5000);
        setName("");
        setUsername(normalizedUsername);
        setEmail(normalizedEmail);
        setPassword("");
      } else {
        const { token, user } = await login(username, password);
        onLogin(token, user);
      }
    } catch (err) {
      const context = awaitingVerification
        ? "Verification"
        : isRegistering
        ? "Registration"
        : "Login";
      const message = err instanceof Error ? err.message : "Something went wrong.";

      if (err instanceof Error) {
        console.error(`${context} error:`, err.message);
      } else {
        console.error("Unknown error:", err);
      }

      setAuthErrorTitle(`${context} Failed`);
      setAuthErrorMessage(message);
      setShowAuthError(true);
      window.setTimeout(() => setShowAuthError(false), 6000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      {showRegistrationNotice && (
        <div className="modal-overlay modal-overlay-confirm">
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-delete-header">
              <h2 style={{ margin: 0 }}>{awaitingVerification ? "Verify Your Email" : "Registration Update"}</h2>
            </div>
            <p style={{ margin: "0 0 1rem 0" }}>
              {registrationNoticeMessage || "An admin will review your registration shortly."}
            </p>
          </div>
        </div>
      )}
      {showAuthError && (
        <div
          className="modal-overlay modal-overlay-confirm"
          onClick={() => setShowAuthError(false)}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-delete-header">
              <h2 style={{ margin: 0 }}>{authErrorTitle || "Authentication Error"}</h2>
              <button
                type="button"
                onClick={() => setShowAuthError(false)}
                className="modal-delete-close"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <p style={{ margin: "0 0 1rem 0" }}>{authErrorMessage}</p>
          </div>
        </div>
      )}
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>{awaitingVerification ? "Verify Email" : isRegistering ? "Register" : "Login"}</h2>

      {awaitingVerification && (
        <>
          <div style={{ marginTop: "0.5rem" }}>
            <small>
              Enter the verification code sent to
            </small>
          </div>
          <div>
            <small>
              <strong>{pendingVerificationEmail || "your email"}</strong>.
            </small>
          </div>
          <div style={{ marginTop: "1rem" }}>
            <label>Verification Code</label><br />
            <input
              type="text"
              required
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
            />
          </div>

          <div style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className="button-link"
              onClick={async () => {
                try {
                  setLoading(true);
                  await resendVerificationCode(pendingVerificationUsername);
                  setRegistrationNoticeMessage("A new verification code was sent.");
                  setShowRegistrationNotice(true);
                  window.setTimeout(() => setShowRegistrationNotice(false), 5000);
                } catch (err) {
                  const message = err instanceof Error ? err.message : "Could not resend verification code";
                  setAuthErrorTitle("Resend Failed");
                  setAuthErrorMessage(message);
                  setShowAuthError(true);
                  window.setTimeout(() => setShowAuthError(false), 6000);
                } finally {
                  setLoading(false);
                }
              }}
              style={{
                background: "none",
                border: "none",
                color: "green",
                textDecoration: "underline",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Resend code
            </button>
          </div>
        </>
      )}

      {isRegistering && !awaitingVerification && (
        <div>
          <label>Name</label><br />
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      )}

      {isRegistering && !awaitingVerification && (
        <div style={{ marginTop: "1rem" }}>
          <label>Email</label><br />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={awaitingVerification}
          />
        </div>
      )}

      <div style={{ marginTop: "1rem" }}>
        <label>Username</label><br />
        <input
          type="text"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={awaitingVerification}
        />
      </div>

      <div style={{ marginTop: "1rem" }}>
        {!awaitingVerification && (
          <>
            <label>Password</label><br />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </>
        )}
      </div>

      <div style={{ marginTop: "0.25rem" }}>
        <button
          type="button"          
          id="button-register"
          className="button-link"
          onClick={() => {
            if (awaitingVerification) {
              setAwaitingVerification(false);
              setVerificationCode("");
              setPendingVerificationUsername("");
              setPendingVerificationEmail("");
            }
            setIsRegistering(!isRegistering);
          }}
          style={{ 
            background: "none", 
            border: "none", 
            color: "green", 
            textDecoration: "underline", 
            cursor: "pointer",
            padding: 0
          }}
        >
          {awaitingVerification
            ? "Back to login"
            : isRegistering
            ? "Have an account? Log in"
            : "New user? Register"}
        </button>
      </div>

      <button
        type="submit"
        id="button-login"
        className="button-pill"
        disabled={loading}
        style={{ marginTop: "1.5rem" }}
      >
        {loading
          ? awaitingVerification
            ? "Verifying..."
            : isRegistering
            ? "Registering..."
            : "Logging in..."
          : awaitingVerification
          ? "Verify Email"
          : isRegistering
          ? "Register"
          : "Log In"}
      </button>
      </form>
    </div>
  );
}


