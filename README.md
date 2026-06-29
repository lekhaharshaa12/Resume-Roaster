# 🔥 Resume Roaster

A modern, full-stack AI-powered SaaS application that gives witty, brutally honest, and genuinely useful feedback on resumes. 

This project is built using **Next.js**, **Prisma ORM**, and integrates **Claude 3.5 Sonnet** and **Groq (Llama 3.3)** to provide high-speed resume roasting, document parsing, and visual OCR.

---

## ✨ Features

- **Text Pasting**: Paste raw resume details directly into a clean, minimal textarea.
- **Multimodal Document Uploads**:
  - **PDF Parser**: Upload `.pdf` documents directly; text is automatically extracted and populated in the input field.
  - **Vision OCR (Llama 4 Scout)**: Upload images/photos (`.png`, `.jpeg`, `.webp`) of a resume. The system uses Groq Llama 4 Scout Vision model to read and transcribe the text automatically.
- **Dual AI Engines**: Supports **Groq Llama 3.3 70B** for lightning-fast, free generation with automatic fallback to **Claude 3.5 Sonnet**.
- **Prisma + MySQL Logging**: Saves every resume text and corresponding generated roast to your local MySQL database, exposed globally via secure SSH tunneling.
- **Premium UI Theme**: Crisp, responsive layout styled in a clean white background with a modern blue theme, smooth page transitions, and status-aware validation indicators.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js (React), Vanilla CSS (glassmorphism details, custom loader animations)
- **Backend APIs**: Next.js Serverless Routes
- **Database**: Local MySQL + Prisma ORM
- **AI Models**:
  - **Text Generation (Roasting)**: `llama-3.3-70b-versatile` (Groq) / `claude-3-5-sonnet-latest` (Anthropic)
  - **Vision OCR (Image extraction)**: `meta-llama/llama-4-scout-17b-16e-instruct` (Groq) / `claude-3-5-sonnet-latest` (Anthropic)

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/YOUR_USERNAME/resume-roaster.git
cd resume-roaster
npm install
```

### 2. Configure Your Database
Make sure you have **MySQL** running on your computer. Open your database GUI (like MySQL Workbench) and create a database:
```sql
CREATE DATABASE resumeroaster;
```

### 3. Expose Database Globally (Optional but recommended)
Run a secure Pinggy TCP tunnel in a separate PowerShell window to allow public servers (like Vercel) to reach your local database:
```powershell
ssh -p 443 -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R0:127.0.0.1:3306 tcp@free.pinggy.io
```
Copy the generated `tcp://...` address.

### 4. Setup Environment Variables
Create a file named `.env` in the root folder (it is already added to `.gitignore`):
```env
# AI Keys (Configure at least one)
GROQ_API_KEY="your-groq-api-key"
ANTHROPIC_API_KEY="your-anthropic-api-key"

# Database connection URL
# For local development:
DATABASE_URL="mysql://root:password@localhost:3306/resumeroaster"
# For external access (replace with your active Pinggy tunnel port):
# DATABASE_URL="mysql://root:password@cslih-xxx.run.pinggy-free.link:PORT/resumeroaster"
```

### 5. Sync Prisma Schema & Generate Client
```bash
npx prisma db push
npx prisma generate
```

### 6. Run the Dev Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!
