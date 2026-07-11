async function htmlToPdfBase64(html) {
  const apiKey = process.env.PDFSHIFT_API_KEY;
  if (!apiKey) {
    throw new Error('PDFSHIFT_API_KEY no configurada en el servidor');
  }

  const pdfRes = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source: html,
      landscape: false,
      use_print: false,
      format: 'A4',
    }),
  });

  if (!pdfRes.ok) {
    const errText = await pdfRes.text();
    throw new Error('PDFShift error (' + pdfRes.status + '): ' + errText);
  }

  const arrayBuffer = await pdfRes.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
}

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
    const { to, subject, text, html, filename } = req.body || {};

    if (!to || !html) {
      return res.status(400).json({ error: 'Faltan datos: to y html son obligatorios' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'RESEND_API_KEY no configurada en el servidor' });
    }

    let pdfBase64;
    try {
      pdfBase64 = await htmlToPdfBase64(html);
    } catch (pdfErr) {
      return res.status(500).json({ error: 'Error generando el PDF: ' + pdfErr.message });
    }

    const payload = {
      from: 'Decotara Outlet <facturas@decotaraoutlet.online>',
      to: [to],
      reply_to: 'DECOTARAOUTLET@gmail.com',
      subject: subject || 'Documento de Decotara Outlet',
      text: text || 'Adjunto encontrara el documento solicitado en PDF.',
      attachments: [
        {
          filename: filename || 'documento.pdf',
          content: pdfBase64,
        },
      ],
    };

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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

// trigger redeploy con PDFSHIFT_API_KEY
