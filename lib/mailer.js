import nodemailer from 'nodemailer';

export async function sendOtpEmail(email, code) {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    console.log('\n✉️ [SMTP CONFIGURATION MISSING]');
    console.log(`Email: ${email} | Code: ${code}`);
    console.log('To send actual emails, define EMAIL_USER and EMAIL_PASS in your .env file.\n');
    return;
  }

  // Create SMTP Transporter (optimised for Gmail SMTP App Passwords)
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // true for port 465, false for other ports
    auth: {
      user,
      pass,
    },
  });

  const mailOptions = {
    from: user,
    to: email,
    subject: "Resume Roaster Verification Code",
    text: `Your verification code is: ${code}. This code is valid for 5 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #2563eb; text-align: center;">Resume Roaster</h2>
        <p>Hello,</p>
        <p>Thank you for signing up. Please use the following 6-digit verification code to complete your registration:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; background-color: #f1f5f9; padding: 10px 20px; border-radius: 4px; border: 1px dashed #cbd5e1;">${code}</span>
        </div>
        <p>This code is valid for 5 minutes. If you did not request this, you can ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="font-size: 12px; color: #64748b; text-align: center;">&copy; ${new Date().getFullYear()} Resume Roaster. All rights reserved.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✓ Email sent successfully to ${email}`);
  } catch (error) {
    console.error('SMTP Mail Transport Error:', error);
    throw new Error('Failed to send verification email. Verify your SMTP credentials.');
  }
}
