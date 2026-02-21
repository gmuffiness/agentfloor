/**
 * Hub API call helper
 */

import { getDefaultOrg } from "./config.mjs";

/**
 * Make an API request to the AgentFactorio hub
 * @param {string} hubUrl - Base URL of the hub
 * @param {string} path - API path (e.g. "/api/cli/login")
 * @param {{ method?: string, body?: unknown, authToken?: string }} [options]
 * @returns {Promise<{ ok: boolean, status: number, data: unknown }>}
 */
export async function apiCall(hubUrl, path, options = {}) {
  const url = `${hubUrl.replace(/\/$/, "")}${path}`;
  const method = options.method || (options.body ? "POST" : "GET");

  const headers = { "Content-Type": "application/json" };
  if (options.authToken) {
    headers["Authorization"] = `Bearer ${options.authToken}`;
  }

  const fetchOptions = { method, headers };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, fetchOptions);
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  return { ok: res.ok, status: res.status, data };
}

/**
 * Make an authenticated API call using the default org's hubUrl and authToken.
 * @param {string} path - API path
 * @param {{ method?: string, body?: unknown }} [options]
 * @returns {Promise<{ ok: boolean, status: number, data: unknown }>}
 */
export async function authApiCall(path, options = {}) {
  const org = getDefaultOrg();
  if (!org) {
    throw new Error("Not logged in. Run `agent-factorio login` first.");
  }
  if (!org.authToken) {
    throw new Error("Auth token missing. Run `agent-factorio login` again to get a token.");
  }
  return apiCall(org.hubUrl, path, { ...options, authToken: org.authToken });
}

/**
 * Check if hub is reachable
 * @param {string} hubUrl
 * @returns {Promise<boolean>}
 */
export async function checkHub(hubUrl) {
  try {
    const res = await fetch(`${hubUrl.replace(/\/$/, "")}/api/cli/login`, {
      method: "OPTIONS",
    });
    // Any response (even 405) means the server is reachable
    return res.status < 500;
  } catch {
    // Try a simple GET to the root
    try {
      const res = await fetch(hubUrl);
      return res.ok;
    } catch {
      return false;
    }
  }
}
