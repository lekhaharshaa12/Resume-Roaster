# 📘 Resume Roaster — Complete Setup Tutorial

This guide takes you through the step-by-step process of configuring, running, and deploying the Resume Roaster web application with Supabase Postgres and Groq.

---

## 🛠️ Step 1 — Supabase PostgreSQL Database Setup

Rather than maintaining a local database server, Resume Roaster is powered by a high-performance cloud **Supabase PostgreSQL** instance:

1. Sign up/Log in at **[supabase.com](https://supabase.com)**.
2. Click **New Project** and select a name, password, and Region.
3. Once the project is provisioned, navigate to **Project Settings** ➔ **Database** ➔ **Connection Strings**.
4. Copy the **URI** connection string. Make sure to choose the connection pooler or direct mode (Prisma works best with the Transaction Connection pooler on port `6543` or standard direct port `5432`).
5. Replace the placeholder password with your database password.
6. Paste the URL directly into your `.env` file under `DATABASE_URL`:
   ```env
   DATABASE_URL="postgresql://postgres.[YOUR_PROJECT_ID]:[YOUR_PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
   ```

---

## 🔑 Step 2 — AI Provider Credentials

The application uses **Groq** for high-speed LLM processing and OCR:

1. Register at **[console.groq.com](https://console.groq.com)**.
2. Generate a API key (starts with `gsk_`).
3. Paste it inside `.env`:
   ```env
   GROQ_API_KEY="gsk_xxxxx..."
   ```
   *This enables `llama-3.3-70b-versatile` for streaming resume roasts and Llama 4 vision model for image OCR uploads.*

---

## 🏗️ Step 3 — Sync Schema & Launch

1. Apply the Prisma schema model to synchronize your Supabase cloud database:
   ```bash
   npx prisma db push
   ```
2. Generate Prisma Client bindings:
   ```bash
   npx prisma generate
   ```
3. Launch the Next.js development server:
   ```bash
   npm run dev
   ```
4. Access the portal at **[http://localhost:3000](http://localhost:3000)**.

---

## ☁️ Step 4 — Deploying to Vercel

1. Push your project code to a GitHub repository.
2. Connect your GitHub repository directly to **Vercel** ([vercel.com](https://vercel.com)).
3. Import the project.
4. Add these exact **Environment Variables** in Vercel settings:
   - `DATABASE_URL` (Your Supabase PostgreSQL connection string)
   - `GROQ_API_KEY` (Your Groq API key)
   - `JWT_SECRET` (A secure random string for JWT sign-in cookies)
   - `EMAIL_USER` (Your Gmail SMTP username)
   - `EMAIL_PASS` (Your Gmail SMTP App Password)
5. Deploy!
