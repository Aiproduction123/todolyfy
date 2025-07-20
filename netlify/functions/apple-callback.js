const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const querystring = require('querystring');

exports.handler = async function(event, context) {
  try {
    // Apple sends a POST request with form data.
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const body = querystring.parse(event.body);
    const code = body.code;

    if (!code) {
      console.error('No authorization code received from Apple.');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No authorization code received.' })
      };
    }

    // Create client secret JWT
    const claims = {
      iss: process.env.APPLE_TEAM_ID,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      aud: 'https://appleid.apple.com',
      sub: process.env.APPLE_CLIENT_ID
    };
    const clientSecret = jwt.sign(claims, process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'), {
      algorithm: 'ES256',
      keyid: process.env.APPLE_KEY_ID
    });

    // Exchange code for token
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${process.env.URL}/auth/apple/callback`,
      client_id: process.env.APPLE_CLIENT_ID,
      client_secret: clientSecret
    });

    const tokenResponse = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.id_token) {
        console.error('Error exchanging Apple auth code for token:', tokenData);
        throw new Error(tokenData.error_description || 'Failed to get id_token from Apple.');
    }

    // Redirect to home page. The client-side will handle the login state.
    return {
      statusCode: 302,
      headers: {
        Location: `/?apple_success=true` // A cleaner redirect
      },
      body: ''
    };
  } catch (error) {
    console.error("Apple callback error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Apple authentication failed." })
    };
  }
};