import { google } from 'googleapis';

// Use the clean redirect URI defined in netlify.toml
const OAUTH2_REDIRECT_URI = `${process.env.URL}/auth/callback`;

export const handler = async function(event, context) {
    // Log environment variables for debugging
    console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);
    console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '[REDACTED]' : 'undefined');
    console.log('OAUTH2_REDIRECT_URI:', OAUTH2_REDIRECT_URI);

    const code = event.queryStringParameters.code;
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        OAUTH2_REDIRECT_URI
    );
    try {
        const { tokens } = await oauth2Client.getToken(code);
        console.log('Google token exchange response:', tokens);
        oauth2Client.setCredentials(tokens);
        const oauth2 = google.oauth2({
            auth: oauth2Client,
            version: 'v2'
        });
        const { data } = await oauth2.userinfo.get();
        console.log('Google userinfo response:', data);
        const { name, picture, email } = data;
        // Set user info cookie and redirect to home page
        const userInfo = JSON.stringify({ name, picture, email });
        return {
            statusCode: 302,
            headers: {
                'Set-Cookie': `user-info=${encodeURIComponent(userInfo)}; Path=/; HttpOnly; SameSite=Lax`,
                Location: `/`
            },
            body: ''
        };
    } catch (error) {
        console.error('Google authentication callback error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Authentication failed.', details: error.message })
        };
    }
};
