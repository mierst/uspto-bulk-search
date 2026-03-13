import React from 'react';

export default function LoginPage() {
  return (
    <div className="login-page">
      <div className="login-card">
        <h1>USPTO Search</h1>
        <p>Trademark Clearance Search Tool</p>
        <a href="/api/auth/google" className="btn btn-primary google-btn">
          Sign in with Google
        </a>
      </div>
    </div>
  );
}
