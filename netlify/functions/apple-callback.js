const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  const code = event.queryStringParameters.code;

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
    redirect_uri: `${process.env.URL}/.netlify/functions/apple-callback`,
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
  const userInfo = jwt.decode(idToken);

  // Redirect to home page with user info
  return {
    statusCode: 302,
    headers: {
      Location: `/?name=${encodeURIComponent(userInfo.name || '')}&email=${encodeURIComponent(userInfo.email || '')}&apple=true`
    },
    body: ''
  };
};
