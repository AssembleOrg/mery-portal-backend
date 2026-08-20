/**
 * Refresh token de Google OAuth — STANDALONE, sin dependencias.
 * Corre en cualquier compu con Node instalado (no necesita el repo ni npm install).
 *
 * Requisito: un ID de cliente OAuth (tipo "App de escritorio", o "Web" con la
 * URI de redireccionamiento http://localhost:53682 registrada).
 *
 * Uso:
 *   node get-token.cjs <CLIENT_ID> <CLIENT_SECRET>
 * o con variables de entorno:
 *   GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... node get-token.cjs
 *
 * Abrí la URL que imprime, logueate con cursos@merygarcia.com.ar y autorizá.
 * Al final imprime el REFRESH TOKEN.
 */
const http = require('http');
const https = require('https');
const { URL, URLSearchParams } = require('url');

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || process.argv[2];
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.argv[3];
const PORT = 53682;
const REDIRECT = `http://localhost:${PORT}`;
const SCOPE = 'https://www.googleapis.com/auth/calendar';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Uso: node get-token.cjs <CLIENT_ID> <CLIENT_SECRET>');
  process.exit(1);
}

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
  }).toString();

function exchange(code) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT,
      grant_type: 'authorization_code',
    }).toString();
    const req = https.request(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(JSON.parse(data)));
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, REDIRECT);
  const code = u.searchParams.get('code');
  if (!code) {
    res.writeHead(400).end('Sin code');
    return;
  }
  try {
    const tokens = await exchange(code);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(
      '<h2>Listo</h2><p>Volve a la terminal.</p>',
    );
    console.log('\n================ REFRESH TOKEN ================\n');
    console.log(tokens.refresh_token || JSON.stringify(tokens, null, 2));
    console.log('\n==============================================\n');
  } catch (e) {
    res.writeHead(500).end('error');
    console.error(e);
  }
  server.close();
  process.exit(0);
});

server.listen(PORT, () => {
  console.log('\n1) Abri esta URL en el navegador (logueado como cursos@merygarcia.com.ar):\n');
  console.log(authUrl + '\n');
  console.log('2) Autorizá. Al volver, el refresh token aparece aca abajo.\n');
});
