const querystring = require('querystring');

exports.handler = async function(event, context) {
  const params = {
    response_type: 'code',
    client_id: process.env.APPLE_CLIENT_ID,
    redirect_uri: `${process.env.URL}/.netlify/functions/apple-callback`,
    scope: 'name email',
    state: 'todolyfy',
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
