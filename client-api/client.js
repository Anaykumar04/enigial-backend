/**
 * Enigoal Success Toolkit — API Client
 * Place this file at: client/src/api/client.js
 *
 * Usage:
 *   import { authAPI, schemesAPI, usersAPI, adminAPI, token } from './api/client';
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ── Token helpers (localStorage) ─────────────────────────────────
export const token = {
  get:   ()  => localStorage.getItem('enigoal_token'),
  set:   (t) => localStorage.setItem('enigoal_token', t),
  clear: ()  => localStorage.removeItem('enigoal_token'),
};

// ── Core fetch wrapper ────────────────────────────────────────────
async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const tok = token.get();
  if (tok) headers['Authorization'] = `Bearer ${tok}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    const msg = data.message || data.errors?.[0]?.msg || 'Request failed';
    throw Object.assign(new Error(msg), { status: res.status, data });
  }

  return data;
}

const get  = (path)        => request('GET',    path);
const post = (path, body)  => request('POST',   path, body);
const put  = (path, body)  => request('PUT',    path, body);
const del  = (path)        => request('DELETE', path);
const patch = (path, body) => request('PATCH',  path, body);

// ── Auth ──────────────────────────────────────────────────────────
export const authAPI = {
  login:  (email, password) => post('/auth/login', { email, password }),
  me:     ()                => get('/auth/me'),
  logout: ()                => post('/auth/logout'),
};

// ── Schemes ───────────────────────────────────────────────────────
export const schemesAPI = {
  /** params: { category, search, status, sector, companyType, location, page, limit } */
  list:   (params = {}) => get(`/schemes?${new URLSearchParams(params)}`),
  get:    (id)          => get(`/schemes/${id}`),
  stats:  ()            => get('/schemes/stats'),
  create: (data)        => post('/schemes', data),
  update: (id, data)    => put(`/schemes/${id}`, data),
  delete: (id)          => del(`/schemes/${id}`),
};

// ── Users (admin) ─────────────────────────────────────────────────
export const usersAPI = {
  list:           ()             => get('/users'),
  get:            (id)           => get(`/users/${id}`),
  create:         (data)         => post('/users', data),
  update:         (id, data)     => put(`/users/${id}`, data),
  changePassword: (id, password) => patch(`/users/${id}/password`, { password }),
  delete:         (id)           => del(`/users/${id}`),
};

// ── Admin ─────────────────────────────────────────────────────────
export const adminAPI = {
  stats:        ()            => get('/admin/stats'),
  activityLogs: (limit = 50)  => get(`/admin/activity-logs?limit=${limit}`),
};

export default { authAPI, schemesAPI, usersAPI, adminAPI, token };
