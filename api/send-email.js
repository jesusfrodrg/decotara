const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

let cachedBrowser = null;

async function getBrowser() {
  if (cachedBrowser && cachedBrowser.isConnected()) {
    return cachedBrowser;
  }
  cachedBrowser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });
  return cachedBrowser;
}

async function htmlToPdfBase64(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 8000 });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    });
    return Buffer.from(pdfBuffer).toString('base64');
  } finally {
    await page.close();
  }
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
      return res.status(500).json({ error: 'Error generando el PDF en el servidor: ' + pdfErr.message });
    }

    const payload = {
      from: 'Decotara Outlet <onboarding@resend.dev>',
      to: [to],
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

module.exports.config = {
  maxDuration: 30,
};
