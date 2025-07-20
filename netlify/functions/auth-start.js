// netlify/functions/auth-start.js

const { google } = require('googleapis');

exports.handler = async function(event, context) {
  // Dynamically construct the redirect URI
  const redirectUri = `${process.env.URL}/.netlify/functions/auth-callback`;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  const scopes = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });

  return {
    statusCode: 302,
    headers: {
      Location: authorizationUrl,
      'Cache-Control': 'no-cache',
    },
    body: '',
  };
};