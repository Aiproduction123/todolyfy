const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  let code;
  if (event.httpMethod === 'POST') {
    const body = event.body;
    const params = new URLSearchParams(body);
    code = params.get('code');
  } else {
    code = event.queryStringParameters.code;
  }

  // Create client secret JWT
  const claims = {
    iss: process.env.APPLE_TEAM_ID,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    aud: 'https://appleid.apple.com',
    sub: process.env.APPLE_CLIENT_ID
  };
  const clientSecret = jwt.sign(claims, process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'), {
    algorithm: 'ES256',
    keyid: process.env.APPLE_KEY_ID
  });

  // Exchange code for token
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    // This redirect_uri must also match your Apple Developer configuration.
    redirect_uri: 'https://www.todolyfy.com/auth/apple/callback',
    client_id: process.env.APPLE_CLIENT_ID,
    client_secret: clientSecret
  });

  const response = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });
  const data = await response.json();

  // Decode id_token to get user info
  const idToken = data.id_token;
  // Note: For production, you should verify the id_token signature before trusting its contents.
  const userInfo = jwt.decode(idToken);

  // You can now use the userInfo.sub as a stable unique identifier for the user.
  // The name and email are only sent on the first authentication.

  // Redirect to home page with user info
  // Be careful about passing sensitive info like email in URL params.
  return {
    statusCode: 302,
    headers: {
      Location: `/?apple_success=true` // A cleaner redirect
    },
    body: ''
  };
};