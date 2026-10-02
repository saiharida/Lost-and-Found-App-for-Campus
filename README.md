# Campus Lost & Found — Sprint 1

Implements PB1–PB4 from the product backlog: campus-email registration, secure login (bcrypt + JWT), and reporting a lost or found item.

## Stack
- Backend: Node.js, Express, MongoDB (Mongoose), bcryptjs, JWT
- Frontend: React (Vite), React Router, Axios

## What's implemented (Sprint 1)
- PB1 — Register with campus email (`POST /api/auth/register`)
- PB2 — Secure login (`POST /api/auth/login`), password hashed with bcrypt, JWT issued
- PB3 — Report lost item (`POST /api/items`, protected route)
- PB4 — Report found item (same endpoint, `type: "found"`)
- Bonus: item listing with lost/found filter (`GET /api/items`), so there's something to demo beyond raw form submission

Not in this sprint (by design, per the backlog): image upload/Cloudinary (PB5), AI-generated images (PB6), matching engine (PB8), hidden-field verification (PB9), claims (PB10+), admin moderation (PB13/14).

## Setup

### 1. MongoDB
Use a local MongoDB instance, or a free MongoDB Atlas cluster. You just need a connection string.

### 2. Backend
```bash
cd server
npm install
cp .env.example .env
# edit .env: set MONGO_URI to your connection string, set JWT_SECRET to any long random string
npm run dev
```
Server runs on http://localhost:5000. Check http://localhost:5000/api/health returns `{"status":"ok"}`.

### 3. Frontend
```bash
cd client
npm install
npm run dev
```
Opens on http://localhost:5173. API calls to `/api/*` are proxied to the backend (see `vite.config.js`).

## Demo script for tomorrow
1. Show the folder structure and explain the MVC-ish split: `models/` (schema), `controllers/` (logic), `routes/` (endpoints), `middleware/` (JWT auth guard) on the backend.
2. Register a new account on the frontend — show the campus email + password form.
3. Open MongoDB Compass (or `mongosh`) and show the `users` collection — point out the password is hashed, not stored in plaintext.
4. Log out, log back in — show the JWT is stored client-side and sent on subsequent requests (Network tab → Authorization header).
5. Report a lost item, then a found item.
6. Show the dashboard listing both, with the lost/found filter.
7. Mention what's next: Sprint 2 adds Cloudinary image upload, the rule-based matching engine, and the hidden verification field.

## Not yet done
- No automated tests yet — can mention this is planned alongside Sprint 2/3 as features stabilize.
- No frontend form validation beyond HTML5 `required` — can be tightened later.
