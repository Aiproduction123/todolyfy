const querystring = require('querystring');

exports.handler = async function(event, context) {
  const params = {
    response_type: 'code',
    client_id: process.env.APPLE_CLIENT_ID,
    // This redirect_uri now exactly matches your Apple Developer configuration.
    redirect_uri: 'https://todolyfy.com/auth/apple/callback',
    scope: 'name email',
    state: 'todolyfy', // It's a good security practice to generate a unique, random state value for each request.
    response_mode: 'form_post'
  };

  const url = `https://appleid.apple.com/auth/authorize?${querystring.stringify(params)}`;

  return {
    statusCode: 302,
    headers: {
      Location: url,
      'Cache-Control': 'no-cache',
    },
    body: ''
  };
}; 