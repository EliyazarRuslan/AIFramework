/* global Headers, Request */
// Microsoft Entra ID (Azure AD) SSO via MSAL Browser.
// - Loads tenantId/clientId from /api/config (server-rendered).
// - Forces login redirect if no active account.
// - Acquires API access token silently and injects Authorization: Bearer
//   on every /api/* fetch via a fetch() wrapper.
// - Exposes window.__auth = { user, logout, getToken, ready }.

import { PublicClientApplication, InteractionRequiredAuthError } from "@azure/msal-browser";

// ID-token mode: we only request OpenID scopes and forward the idToken to the API.
const ID_SCOPES = ["openid", "profile", "email"];

const STATE = {
  msal: null,
  account: null,
  authDisabled: false,
  readyResolvers: [],
  ready: false,
};

function emitReady() {
  STATE.ready = true;
  for (const fn of STATE.readyResolvers) {
    try {
      fn();
    } catch {
      // ready handler errors must not block other handlers.
    }
  }
  STATE.readyResolvers = [];
}

export function onAuthReady(fn) {
  if (STATE.ready) fn();
  else STATE.readyResolvers.push(fn);
}

async function loadConfig() {
  const r = await fetch("/api/config");
  if (!r.ok) throw new Error("Failed to load /api/config");
  return r.json();
}

function showLoginGate(message) {
  let el = document.getElementById("auth-gate");
  if (!el) {
    el = document.createElement("div");
    el.id = "auth-gate";
    el.style.cssText = `
      position:fixed;inset:0;background:#0b0e14;color:#e6edf3;
      display:flex;align-items:center;justify-content:center;flex-direction:column;
      z-index:99999;font-family:system-ui,-apple-system,sans-serif;gap:16px;text-align:center;padding:24px;
    `;
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <h1 style="margin:0;font-size:24px;font-weight:600">AI Framework — Sign in</h1>
    <p style="margin:0;color:#8b949e;max-width:420px">${message || "Sign in with your Goldbell Microsoft account to continue."}</p>
    <button id="auth-gate-btn" style="padding:10px 20px;background:#2f81f7;color:#fff;border:0;border-radius:6px;font-size:14px;cursor:pointer">Sign in with Microsoft</button>
  `;
  document.getElementById("auth-gate-btn").onclick = () => {
    STATE.msal.loginRedirect({ scopes: ID_SCOPES });
  };
}

function hideLoginGate() {
  const el = document.getElementById("auth-gate");
  if (el) el.remove();
}

function renderUserBadge() {
  if (!STATE.account) return;
  let el = document.getElementById("auth-user-badge");
  if (!el) {
    el = document.createElement("div");
    el.id = "auth-user-badge";
    el.style.cssText = `
      position:fixed;top:10px;right:10px;z-index:9999;
      background:rgba(11,14,20,.85);color:#e6edf3;padding:6px 10px;border-radius:6px;
      font:12px system-ui,-apple-system,sans-serif;display:flex;gap:8px;align-items:center;
      border:1px solid rgba(255,255,255,.08);
    `;
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <span title="${STATE.account.username}">${STATE.account.name || STATE.account.username}</span>
    <button id="auth-logout-btn" style="background:transparent;color:#8b949e;border:0;cursor:pointer;font-size:12px;padding:0">Sign out</button>
  `;
  document.getElementById("auth-logout-btn").onclick = () => {
    STATE.msal.logoutRedirect({ account: STATE.account });
  };
}

async function getToken() {
  if (STATE.authDisabled) return "dev-disabled";
  if (!STATE.account) throw new Error("Not signed in.");
  try {
    const r = await STATE.msal.acquireTokenSilent({
      account: STATE.account,
      scopes: ID_SCOPES,
    });
    // ID-token mode: forward idToken instead of accessToken so the API can verify
    // audience == clientId (no custom api://<clientId> scope needed in Azure).
    return r.idToken || r.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      STATE.msal.acquireTokenRedirect({ scopes: ID_SCOPES });
      throw err;
    }
    throw err;
  }
}

function installFetchInterceptor() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    const isApi =
      url.startsWith("/api/") && !url.startsWith("/api/config") && !url.startsWith("/api/health");
    if (!isApi) return originalFetch(input, init);

    if (STATE.authDisabled) return originalFetch(input, init);

    try {
      const token = await getToken();
      const headers = new Headers(init.headers || (input instanceof Request ? input.headers : {}));
      headers.set("Authorization", "Bearer " + token);
      return originalFetch(input, { ...init, headers });
    } catch (err) {
      console.warn("[auth] token fetch failed:", err.message);
      return originalFetch(input, init);
    }
  };
}

export async function initAuth() {
  const cfg = await loadConfig();
  STATE.authDisabled = !!cfg.authDisabled;

  if (STATE.authDisabled) {
    console.warn("[auth] AUTH_DISABLED — running without SSO (dev only).");
    window.__auth = {
      user: { name: "Dev User", email: "dev@local" },
      logout: () => {},
      getToken: async () => "dev-disabled",
      ready: true,
    };
    installFetchInterceptor();
    emitReady();
    return;
  }

  if (!cfg.tenantId || !cfg.clientId) {
    showLoginGate("SSO not configured. Ask admin to set ENTRA_TENANT_ID and ENTRA_CLIENT_ID.");
    return;
  }

  // Use server-pinned redirect URI when provided; fall back to current origin
  // for local dev convenience. Production .env must set ENTRA_REDIRECT_URI.
  const redirectUri = cfg.redirectUri || window.location.origin;

  STATE.msal = new PublicClientApplication({
    auth: {
      clientId: cfg.clientId,
      authority: `https://login.microsoftonline.com/${cfg.tenantId}`,
      redirectUri,
      postLogoutRedirectUri: redirectUri,
    },
    cache: {
      cacheLocation: "sessionStorage",
      storeAuthStateInCookie: false,
    },
  });

  await STATE.msal.initialize();

  installFetchInterceptor();

  const redirectResult = await STATE.msal.handleRedirectPromise().catch((err) => {
    console.error("[auth] redirect error:", err);
    return null;
  });

  if (redirectResult?.account) {
    STATE.msal.setActiveAccount(redirectResult.account);
    STATE.account = redirectResult.account;
  } else {
    const accounts = STATE.msal.getAllAccounts();
    if (accounts.length > 0) {
      STATE.account = accounts[0];
      STATE.msal.setActiveAccount(STATE.account);
    }
  }

  if (!STATE.account) {
    showLoginGate();
    return;
  }

  hideLoginGate();
  renderUserBadge();

  window.__auth = {
    user: {
      name: STATE.account.name,
      email: STATE.account.username,
      oid: STATE.account.localAccountId,
    },
    logout: () => STATE.msal.logoutRedirect({ account: STATE.account }),
    getToken,
    ready: true,
  };

  emitReady();
}
