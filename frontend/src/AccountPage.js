import React, { useState } from "react";

const API = process.env.REACT_APP_API_BASE || "";

// Change-password form for a logged-in user. The backend still verifies the current password.
export default function AccountPage({ user }) {
  const identifier = user?.email || user?.username || "";
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBanner(null);
    if (newPassword.length < 6) {
      setBanner({ type: "error", message: "New password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setBanner({ type: "error", message: "The new passwords do not match." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: "error", message: data.detail || "Password change failed." });
      } else {
        setBanner({ type: "success", message: data.message || "Password changed." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setBanner({ type: "error", message: "Could not reach the server. Is the backend running?" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="anim-fadeUp">
      <div className="ev-page-head">
        <h1>Account</h1>
        <p>Signed in as {identifier || "guest"}. Change your password below.</p>
      </div>
      <div className="ev-two">
      <form className="ev-panel ev-account-form" onSubmit={submit}>
        <h2 className="ev-panel-title">Change password</h2>
        {banner && (
          <div className={`ev-account-banner is-${banner.type}`} role="status">
            {banner.message}
          </div>
        )}
        <label>
          <span>Current password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </label>
        <label>
          <span>New password</span>
          <input
            type="password"
            required
            minLength={6}
            placeholder="At least 6 characters"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </label>
        <label>
          <span>Confirm new password</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </label>
        <button type="submit" className="ev-btn ev-btn--primary" disabled={loading}>
          {loading ? "Changing…" : "Change password"}
        </button>
      </form>
      <aside className="ev-panel ev-account-side">
        <h2 className="ev-panel-title">Your account</h2>
        <dl className="ev-account-details">
          <div><dt>Name</dt><dd>{user?.name || "-"}</dd></div>
          <div><dt>Username</dt><dd>{user?.username || "-"}</dd></div>
          <div><dt>Email</dt><dd>{user?.email || "-"}</dd></div>
          <div><dt>Organisation</dt><dd>{user?.org || "-"}</dd></div>
        </dl>
        <h2 className="ev-panel-title" style={{ marginTop: 26 }}>Password tips</h2>
        <ul className="ev-account-tips">
          <li>Use at least 6 characters; longer is better.</li>
          <li>Do not reuse a password from another site.</li>
          <li>You will need your current password to change it.</li>
          <li>Forgotten it? Contact your administrator to have it reset.</li>
        </ul>
      </aside>
      </div>
    </div>
  );
}
