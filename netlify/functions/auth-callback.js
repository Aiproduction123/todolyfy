const { google } = require('googleapis');
const querystring = require('querystring');

exports.handler = async function(event, context) {
  const code = event.queryStringParameters.code;

  // The redirect_uri must be the public-facing URL, exactly matching what's in your Google Cloud Console
  // and what was used in the auth-start function.
  const redirectUri = `${process.env.URL}/auth/google/callback`;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: 'v2'
    });

    const { data: user } = await oauth2.userinfo.get();

    // Redirect to the home page with user info in query params
    const params = {
      name: user.name,
      picture: user.picture
    };

    return {
      statusCode: 302,
      headers: {
        Location: `/?${querystring.stringify(params)}`,
        'Cache-Control': 'no-cache'
      },
      body: ''
    };
  } catch (error) {
    console.error('Error exchanging token:', error);
    return {
      statusCode: 500,
      body: 'Authentication failed. Please try again.'
    };
  }
};
