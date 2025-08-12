const jwt = require('jsonwebtoken');
const querystring = require('querystring');

exports.handler = async function(event, context) {
  try {
    // Apple sends a POST request with form data.
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // Log environment variables for debugging
    console.log('APPLE_CLIENT_ID:', process.env.APPLE_CLIENT_ID);
    console.log('APPLE_KEY_ID:', process.env.APPLE_KEY_ID);
    console.log('APPLE_TEAM_ID:', process.env.APPLE_TEAM_ID);
    console.log('APPLE_PRIVATE_KEY:', process.env.APPLE_PRIVATE_KEY ? '[REDACTED]' : 'undefined');

    const body = querystring.parse(event.body);
    const code = body.code;
    // Apple sends user's name on first auth in the `user` field.
    const userPayload = body.user ? JSON.parse(body.user) : null;
    const userName = userPayload ? `${userPayload.name.firstName} ${userPayload.name.lastName}` : null;


    if (!code) {
      console.error('No authorization code received from Apple.');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No authorization code received.' })
      };
    }

    // Use the exact same redirect_uri as in the initial Apple auth step
    const redirect_uri = `${process.env.URL}/auth/apple/callback`;
    console.log('Apple callback redirect_uri:', redirect_uri);

    // Create client secret JWT
    const claims = {
      iss: process.env.APPLE_TEAM_ID,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      aud: 'https://appleid.apple.com',
      sub: process.env.APPLE_CLIENT_ID
    };
    let clientSecret;
    try {
      clientSecret = jwt.sign(claims, process.env.APPLE_PRIVATE_KEY.replace(/\n/g, '\n'), {
        algorithm: 'ES256',
        keyid: process.env.APPLE_KEY_ID
      });
    } catch (jwtError) {
      console.error('Error creating Apple client secret JWT:', jwtError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Error creating Apple client secret JWT', details: jwtError.message })
      };
    }

    // Exchange code for token
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri,
      client_id: process.env.APPLE_CLIENT_ID,
      client_secret: clientSecret
    });

    const tokenResponse = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams
    });

    const tokenData = await tokenResponse.json();
    console.log('Apple token exchange response:', tokenData);

    if (!tokenResponse.ok || !tokenData.id_token) {
        console.error('Error exchanging Apple auth code for token:', tokenData);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Failed to get id_token from Apple', details: tokenData })
        };
    }

    // Decode the token to get user's email and unique ID (sub).
    // For production, you should also verify the token signature.
    const decodedToken = jwt.decode(tokenData.id_token);
    const email = decodedToken.email;

    // Redirect to the home page with user info in the query parameters.
    const params = new URLSearchParams();
    if (userName) params.set('name', userName);
    if (email) params.set('email', email);
    params.set('apple_success', 'true');

    return {
      statusCode: 302,
      headers: {
        Location: `/?${params.toString()}`
      },
      body: ''
    };
  } catch (error) {
    console.error('Apple callback error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Apple authentication failed.', details: error.message })
    };
  }
};