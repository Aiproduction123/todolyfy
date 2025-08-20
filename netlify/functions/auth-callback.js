// netlify/functions/auth-callback.js

const { google } = require('googleapis');
const jwt = require('jsonwebtoken');

exports.handler = async function(event, context) {
  // Dynamically construct the redirect URI to match auth-start
  const redirectUri = `${process.env.URL}/.netlify/functions/auth-callback`;
  const code = event.queryStringParameters.code;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // ... (the rest of your code remains the same)
    
    const oauth2 = google.oauth2({
        auth: oauth2Client,
        version: 'v2'
    });
    const { data } = await oauth2.userinfo.get();
    
    // In a real app, you would find or create a user in your database
    const user = { id: data.email, email: data.email, name: data.name };
    
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    // Redirect to the frontend with user info so the existing UI can pick it up
    const frontendUrl = `/?name=${encodeURIComponent(data.name || 'User')}` +
                        `&email=${encodeURIComponent(data.email || '')}` +
                        `&picture=${encodeURIComponent(data.picture || '')}` +
                        `&token=${encodeURIComponent(token)}`;

    return {
        statusCode: 302,
        headers: {
            Location: frontendUrl,
            'Cache-Control': 'no-cache'
        },
        body: ''
    };

  } catch (error) {
    console.error('Error exchanging token:', error);
    const errorRedirect = `/?error=Authentication%20failed.%20Please%20try%20again.`;
    return {
      statusCode: 302,
      headers: {
        Location: errorRedirect,
        'Cache-Control': 'no-cache',
      },
      body: '',
    };
  }
};