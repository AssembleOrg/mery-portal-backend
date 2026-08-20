/**
 * Obtiene un refresh token de Google (OAuth) para el calendario de mentorías.
 *
 * Requisitos previos (una vez, en Google Cloud):
 *  - Pantalla de consentimiento OAuth: User Type "Internal" (pistech.net Workspace).
 *  - Credenciales → Crear → ID de cliente OAuth → "App de escritorio".
 *    Copiá client_id y client_secret.
 *
 * Uso (en tu máquina, con navegador):
 *   GOOGLE_OAUTH_CLIENT_ID=xxx GOOGLE_OAUTH_CLIENT_SECRET=yyy \
 *     pnpm exec ts-node scripts/get-google-refresh-token.ts
 *
 * Abrí la URL que imprime, logueate con charly@pistech.net y autorizá.
 * Al final imprime el REFRESH TOKEN → lo cargás en GOOGLE_OAUTH_REFRESH_TOKEN.
 */
import * as http from 'http';
import { google } from 'googleapis';

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const PORT = 53682;
const REDIRECT = `http://localhost:${PORT}`;
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Falta GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET');
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT);

const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // fuerza que devuelva refresh_token
  scope: SCOPES,
});

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '', REDIRECT);
    const code = url.searchParams.get('code');
    if (!code) {
      res.writeHead(400).end('Sin code');
      return;
    }
    const { tokens } = await oauth2.getToken(code);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(
      '<h2>Listo ✅</h2><p>Ya podés cerrar esta pestaña y volver a la terminal.</p>',
    );
    console.log('\n================ REFRESH TOKEN ================\n');
    console.log(tokens.refresh_token || '(no vino refresh_token — revisá prompt=consent)');
    console.log('\n==============================================\n');
    server.close();
    process.exit(0);
  } catch (err) {
    res.writeHead(500).end('Error');
    console.error(err);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`\nEsperando la autorización en ${REDIRECT}`);
  console.log('\n1) Abrí esta URL en el navegador y autorizá con charly@pistech.net:\n');
  console.log(authUrl + '\n');
});
