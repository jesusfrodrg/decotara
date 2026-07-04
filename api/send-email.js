module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, subject, text, filename, pdfBase64 } = req.body || {};

    if (!to || !pdfBase64) {
      return res.status(400).json({ error: 'Faltan datos: to y pdfBase64 son obligatorios' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'RESEND_API_KEY no configurada en el servidor' });
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Decotara Outlet <onboarding@resend.dev>',
        to: [to],
        subject: subject || 'Documento de Decotara Outlet',
        text: text || 'Adjunto encontrara el documento solicitado.',
        attachments: [
          {
            filename: filename || 'documento.pdf',
            content: pdfBase64,
          },
        ],
      }),
    });

    const data = await resendRes.json();

    if (!resendRes.ok) {
      return res.status(resendRes.status).json({ error: data.message || 'Error enviando el correo' });
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error desconocido' });
  }
};
