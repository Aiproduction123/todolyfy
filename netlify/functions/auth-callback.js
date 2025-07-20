import { google } from 'googleapis';

// Use the clean redirect URI defined in netlify.toml
const OAUTH2_REDIRECT_URI = `${process.env.URL}/auth/callback`;

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
        // Redirect to the home page with user info in the query parameters.
        // The client-side code will then handle storing this in localStorage.
        const redirectUrl = new URL('/', process.env.URL);
        redirectUrl.searchParams.set('name', name || '');
        redirectUrl.searchParams.set('picture', picture || '');
        redirectUrl.searchParams.set('email', email || '');

        return {
            statusCode: 302,
            headers: {
                Location: redirectUrl.toString()
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
