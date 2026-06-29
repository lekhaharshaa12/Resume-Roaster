# 📘 Resume Roaster — Complete Setup Tutorial

This guide takes you through the step-by-step process of configuring, running, and deploying the Resume Roaster web application.

---

## 🛠️ Step 1 — Local MySQL Database Setup

1. Open your MySQL client (Workbench, Command Line, or phpMyAdmin).
2. Connect to your local server instance (typically `localhost:3306`).
3. Run the following commands to create the database and prepare user privileges for tunneling:
   ```sql
   -- Create database
   CREATE DATABASE resumeroaster;

   -- Grant permissions to allow external connections (needed for tunneling)
   CREATE USER 'harshaa2798'@'%' IDENTIFIED BY 'Sunny0910';
   GRANT ALL PRIVILEGES ON resumeroaster.* TO 'harshaa2798'@'%';
   FLUSH PRIVILEGES;
   ```

---

## 🌐 Step 2 — Tunneling MySQL Globally (Pinggy)

To allow hosted backends (like Vercel) to write logs directly to your laptop's MySQL instance:

1. Open **PowerShell** on your computer.
2. Start an SSH-based TCP tunnel on port `3306` directly to Pinggy (completely free, no card required):
   ```powershell
   ssh -p 443 -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R0:127.0.0.1:3306 tcp@free.pinggy.io
   ```
3. Look for the public forward address in the terminal output. It will look like this:
   `tcp://cslih-104-28-155-21.run.pinggy-free.link:45035`
4. Update the host and port in your `.env` file with this active tunnel information:
   ```env
   DATABASE_URL="mysql://harshaa2798:Sunny0910@cslih-104-28-155-21.run.pinggy-free.link:45035/resumeroaster"
   ```

---

## 🔑 Step 3 — AI Provider Credentials

The application dynamically toggles between **Groq** and **Claude** based on available keys:

### Groq Key (Default & Fast)
1. Register at **[console.groq.com](https://console.groq.com)**.
2. Generate an API key (starts with `gsk_`).
3. Paste it inside `.env`:
   ```env
   GROQ_API_KEY="gsk_xxxxx..."
   ```
   *This enables `llama-3.3-70b-versatile` for lightning-fast resume roasts and Llama 4 vision model for image OCR uploads.*

### Claude Key (High Quality)
1. Register at **[console.anthropic.com](https://console.anthropic.com)**.
2. Obtain an API Key (starts with `sk-ant-`).
3. Add it to `.env`:
   ```env
   ANTHROPIC_API_KEY="sk-ant-xxxxx..."
   ```
   *If the Groq key is commented out, the application automatically uses `claude-3-5-sonnet-latest` for roasting and Vision OCR.*

---

## 🏗️ Step 4 — Sync Schema & Launch

1. Apply the Prisma schema model to create the database tables:
   ```bash
   npx prisma db push
   ```
2. Generate client helper files:
   ```bash
   npx prisma generate
   ```
3. Launch the Next.js development server:
   ```bash
   npm run dev
   ```
4. Access the portal at **[http://localhost:3000](http://localhost:3000)**.

---

## ☁️ Step 5 — Deploying to Vercel

1. Install Vercel CLI or connect your GitHub repository directly to Vercel.
2. Import the project.
3. Add these exact **Environment Variables** in Vercel settings:
   - `GROQ_API_KEY` (or `ANTHROPIC_API_KEY`)
   - `DATABASE_URL` (your active Pinggy tunnel connection string)
4. Deploy! Your live site will connect directly back to the database running on your laptop.
