# 🔥 Resume Roaster

A modern, full-stack AI-powered SaaS application that gives witty, brutally honest, and genuinely useful feedback on resumes. Designed to wow users with rich aesthetics, real-time streaming feedback, multimodal file parsing, and a secure passwordless onboarding experience.

---

## ✨ Features

### 📨 Passwordless OTP Email Authentication
- **Fast Background Delivery**: Verification emails are sent concurrently in the background via Gmail SMTP, allowing the frontend to receive an instant success response and open the verification screen without SMTP network delays.
* **Resend Code Lock**: Enforces a 30-second countdown timer on the verification screen to lock the resend button and prevent mail delivery rate limits or spam.
* **Full Code Auto-Pasting**: Paste a copied 6-digit OTP code directly into the input fields; the system automatically splits the characters, fills all 6 boxes, and focuses the final element.
* **Strict Manual Verification**: De-routes automatic redirects on typing the 6th digit, keeping the code in the inputs until the user clicks the "Verify Code" button.

### 🔒 Password Strength Validator & Manager Integration
* **5-Segment Strength Meter**: Real-time evaluation of password complexity based on length (min 8), uppercase letters, lowercase letters, numbers, and special symbols.
* **Submit with Separate Alert Cards**: The registration submission button remains enabled at all times. If the password fails any requirements or fails to match the confirm password, separate red warning alerts are displayed dynamically for each issue.
* **Independent Visibility Toggles**: Distinct "Show/Hide" toggle buttons are provided for both the Password and Confirm Password inputs.
* **Credential Manager Auto-Save**: Includes a hidden read-only email input field inside the password form to help Chrome, Safari, Edge, and Google Password Manager link the email address and password together as a complete pair upon signup completion.

### ⚡ Multimodal AI Processing & SSE Streaming
* **Real-Time Typewriter Streaming (Server-Sent Events)**: Leverages Groq async completion streams to send feedback tokens to the browser as they are generated.
* **Vision OCR (Llama 4 Scout)**: Upload image resumes (PNG, JPEG, WebP). The system uses the Groq Llama 4 Scout Vision model to extract plain text on-the-fly.
* **PDF Document Parser**: Directly uploads and extracts content from `.pdf` resumes.
* **Stream Cancellation (AbortController)**: Includes a "Cancel" action that uses `AbortController` signals to cancel the fetch request in the browser. The Next.js API endpoint catches this cancellation (`req.on('close')`) and stops the Groq stream to conserve tokens.

### 📜 Saved History Sidebar
* Features a premium **left slide-in history drawer** that retrieves and displays a user's previous resume roasts, letting them review historical transcripts instantly.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js (React), Vanilla CSS (harmonies, glassmorphism, dynamic transitions)
- **Backend APIs**: Next.js Serverless Routes
- **Database**: Supabase PostgreSQL + Prisma ORM
- **AI Models**:
  - **Text Generation (Streaming)**: `llama-3.3-70b-versatile` (Groq)
  - **Vision OCR (Image extraction)**: `meta-llama/llama-4-scout-17b-16e-instruct` (Groq)
- **Mailing**: Nodemailer (Gmail SMTP App Password)

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/YOUR_USERNAME/resume-roaster.git
cd resume-roaster
npm install
```

### 2. Configure Environment Variables
Create a file named `.env` in the root folder:
```env
# Supabase PostgreSQL Connection String
DATABASE_URL="postgresql://postgres.[YOUR_PROJECT_ID]:[YOUR_PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"

# Groq API Key
GROQ_API_KEY="gsk_your_groq_key"

# Auth Secret (For signing session cookies)
JWT_SECRET="your-random-jwt-secret-string"

# SMTP Mailer Configurations
EMAIL_USER="name@gmail.com"
EMAIL_PASS="xxxx xxxx xxxx xxxx" # 16-character Gmail App Password (with spaces)
```

### 3. Sync Database Schema & Generate Prisma Client
```bash
npx prisma db push
npx prisma generate
```

### 4. Run the Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!
