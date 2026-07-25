# Enigoal Success Toolkit — Backend API (MongoDB)

A complete REST API backend using Node.js, Express, MongoDB, and JWT authentication.

---

## Prerequisites

- **Node.js** v18+ — https://nodejs.org
- **MongoDB** (one of):
  - Local: https://www.mongodb.com/try/download/community
  - Free cloud: https://www.mongodb.com/atlas (recommended — no install needed)

---

## Setup

### Option A — MongoDB Atlas (Cloud, Recommended)

1. Go to https://www.mongodb.com/atlas and create a free account
2. Create a free **M0** cluster
3. Click **Connect → Drivers** and copy the connection string
4. Open `.env` and replace the `MONGO_URI` line:
   ```
   MONGO_URI=mongodb+srv://youruser:yourpass@cluster0.xxxxx.mongodb.net/enigoal
   ```

### Option B — Local MongoDB

Install MongoDB Community Edition, then leave `.env` as-is:
```
MONGO_URI=mongodb://localhost:27017/enigoal
```

---

## Running the Server

```bash
# 1. Install dependencies
npm install

# 2. Seed the database (105 schemes + 2 users)
npm run seed

# 3. Start
npm start          # production
npm run dev        # development (auto-restarts on file save)
```

Server runs at **http://localhost:5000**

---

## Default Login Credentials

| Role  | Email               | Password    |
|-------|---------------------|-------------|
| Admin | admin@enigoal.in    | enigoal123  |
| User  | user@enigoal.in     | user123     |

> ⚠️ Change these before deploying to production!

---

## Project Structure

```
server/
├── server.js                 ← Entry point
├── .env                      ← Config (edit MONGO_URI here)
├── seed-data.js              ← Converted schemes (auto-generated)
├── src/
│   ├── config/
│   │   └── db.js             ← MongoDB connection
│   ├── models/
│   │   ├── User.js           ← User schema (bcrypt, role)
│   │   ├── Scheme.js         ← Scheme schema (all 105 fields)
│   │   └── ActivityLog.js    ← Audit log (auto-expires after 90 days)
│   ├── middleware/
│   │   └── auth.js           ← JWT verify + admin guard
│   ├── routes/
│   │   ├── auth.js           ← Login / logout / me
│   │   ├── schemes.js        ← Scheme CRUD + filtering
│   │   ├── users.js          ← User management (admin only)
│   │   └── admin.js          ← Stats + activity logs
│   └── seed.js               ← Database seeder
└── client-api/
    └── client.js             ← Drop into client/src/api/client.js
```

---

## API Reference

### Auth
| Method | Path               | Access | Body                        |
|--------|--------------------|--------|-----------------------------|
| POST   | `/api/auth/login`  | Public | `{ email, password }`       |
| GET    | `/api/auth/me`     | Auth   | —                           |
| POST   | `/api/auth/logout` | Auth   | —                           |

### Schemes
| Method | Path                      | Access | Description              |
|--------|---------------------------|--------|--------------------------|
| GET    | `/api/schemes`            | Auth   | List + filter + paginate |
| GET    | `/api/schemes/stats`      | Auth   | Counts by category       |
| GET    | `/api/schemes/categories` | Auth   | Distinct categories      |
| GET    | `/api/schemes/:id`        | Auth   | Single scheme            |
| POST   | `/api/schemes`            | Admin  | Create scheme            |
| PUT    | `/api/schemes/:id`        | Admin  | Update scheme            |
| DELETE | `/api/schemes/:id`        | Admin  | Delete scheme            |

**Filter params for GET /api/schemes:**
`?category=GRANT&search=tide&status=active&sector=FinTech&companyType=LLP&location=Gujarat&page=1&limit=50`

### Users (Admin only)
| Method | Path                          | Description         |
|--------|-------------------------------|---------------------|
| GET    | `/api/users`                  | List all users      |
| POST   | `/api/users`                  | Create user         |
| PUT    | `/api/users/:id`              | Update name/role    |
| PATCH  | `/api/users/:id/password`     | Change password     |
| DELETE | `/api/users/:id`              | Delete user         |

### Admin
| Method | Path                         | Description           |
|--------|------------------------------|-----------------------|
| GET    | `/api/admin/stats`           | Dashboard statistics  |
| GET    | `/api/admin/activity-logs`   | Recent activity trail |

---

## Connecting the Frontend

### Step 1 — Copy the API client
Copy `client-api/client.js` → `client/src/api/client.js`

### Step 2 — Create `client/.env`
```
VITE_API_URL=http://localhost:5000/api
```
Then restart Vite (`Ctrl+C` → `npm run dev`).

### Step 3 — Update `LoginPage.jsx`
Add import at top:
```js
import { authAPI, token } from '../api/client';
```
Replace `handleSubmit`:
```js
const handleSubmit = async () => {
  setError('');
  setLoading(true);
  try {
    const result = await authAPI.login(email.trim().toLowerCase(), password);
    token.set(result.token);
    onLogin(result.user);
  } catch (err) {
    setError(err.message || 'Invalid email or password.');
  }
  setLoading(false);
};
```

### Step 4 — Update `App.jsx`
Add import at top:
```js
import { useEffect } from 'react';
import { schemesAPI, authAPI, token } from './api/client';
```
Replace schemes state + add useEffect:
```js
const [schemes, setSchemes] = useState([]);

useEffect(() => {
  if (!user) return;
  schemesAPI.list({ limit: 200 }).then(r => setSchemes(r.data));
}, [user]);
```
Update handleLogout:
```js
const handleLogout = () => {
  authAPI.logout().catch(() => {});
  token.clear();
  setUser(null);
};
```

### Step 5 — Update `AdminPanel.jsx`
Add import at top:
```js
import { schemesAPI, usersAPI } from '../api/client';
```
Make `saveScheme` async and replace body:
```js
const saveScheme = async () => {
  if (!form.name.trim()) return showToast('Scheme name is required', 'error');
  try {
    if (isAdding) {
      const res = await schemesAPI.create({
        ...form,
        benefits:    form.benefits.filter(Boolean),
        eligibility: form.eligibility.filter(Boolean),
      });
      setSchemes(prev => [...prev, res.data]);
      showToast(`"${res.data.name}" added successfully`, 'success');
    } else {
      const res = await schemesAPI.update(editScheme.id, {
        ...form,
        benefits:    form.benefits.filter(Boolean),
        eligibility: form.eligibility.filter(Boolean),
      });
      setSchemes(prev => prev.map(s => s.id === res.data.id ? res.data : s));
      showToast(`"${res.data.name}" updated successfully`, 'success');
    }
    closeForm();
  } catch (err) {
    showToast(err.message || 'Failed to save scheme', 'error');
  }
};
```
Make `deleteScheme` async:
```js
const deleteScheme = async (id) => {
  const s = schemes.find(x => x.id === id);
  try {
    await schemesAPI.delete(id);
    setSchemes(prev => prev.filter(x => x.id !== id));
    showToast(`"${s?.name}" deleted`, 'success');
  } catch (err) {
    showToast(err.message || 'Failed to delete', 'error');
  }
  setConfirmDelete(null);
};
```

---

## How Data Persists Now

```
Admin creates user in UI
        ↓
usersAPI.create() → POST /api/users
        ↓
MongoDB saves User document
        ↓
User can log in immediately ✅
Survives server restarts ✅

Admin edits/adds scheme
        ↓
schemesAPI.create/update() → POST/PUT /api/schemes
        ↓
MongoDB saves Scheme document
        ↓
All users see changes immediately ✅
Changes persist after refresh ✅
```
