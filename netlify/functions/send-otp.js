// Netlify serverless function — hides Brevo API key from frontend
exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { toName, toEmail, otpCode } = JSON.parse(event.body);

    if (!toName || !toEmail || !otpCode) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing fields' }) };
    }

    // Basic email validation
    if (!toEmail.includes('@') || !toEmail.includes('.')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid email' }) };
    }

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="color:#0a2540;margin:0 0 4px">EduPath</h2>
        <p style="color:#666;font-size:13px;margin:0 0 20px">Nigerian Exam Prep</p>
        <p style="color:#333">Hi <strong>${toName}</strong>,</p>
        <p style="color:#333">Welcome to EduPath! Use the code below to verify your email and complete registration.</p>
        <div style="background:#0a2540;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
          <div style="font-size:36px;font-weight:900;letter-spacing:8px;color:#00d4ff;font-family:monospace">${otpCode}</div>
          <p style="color:#aaa;font-size:12px;margin:8px 0 0">Expires in 10 minutes</p>
        </div>
        <p style="color:#666;font-size:13px">If you did not create an EduPath account, please ignore this email.</p>
        <p style="color:#666;font-size:13px">&#8212; The EduPath Team &nbsp;|&nbsp; edupath-ng.netlify.app</p>
      </div>
    `;

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY, // stored securely in Netlify env vars
      },
      body: JSON.stringify({
        sender: { name: 'EduPath', email: process.env.BREVO_SENDER_EMAIL },
        to: [{ email: toEmail, name: toName }],
        subject: `${otpCode} is your EduPath verification code`,
        htmlContent: html,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('Brevo error:', response.status, err);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: err.message || 'Email send failed' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
