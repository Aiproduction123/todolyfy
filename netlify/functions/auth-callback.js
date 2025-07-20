import { google } from 'googleapis';

const OAUTH2_REDIRECT_URI = `${process.env.URL}/.netlify/functions/auth-callback`;

export const handler = async function(event, context) {
    const code = event.queryStringParameters.code;
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        OAUTH2_REDIRECT_URI
    );
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        const oauth2 = google.oauth2({
            auth: oauth2Client,
            version: 'v2'
        });
        const { data } = await oauth2.userinfo.get();
        const { name, picture, email } = data;
        const state = event.queryStringParameters.state;
        const redirectPath = state ? JSON.parse(Buffer.from(state, 'base64').toString()).redirectPath : '/';
        // Redirect to home page with user info in query params
        return {
            statusCode: 302,
            headers: {
                Location: `/?name=${encodeURIComponent(name)}&picture=${encodeURIComponent(picture)}&email=${encodeURIComponent(email)}`
            },
            body: ''
        };
    } catch (error) {
        console.error("Authentication callback error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Authentication failed." })
        };
    }
};
