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

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: `
                <html><body>
                    <h1>Login Successful!</h1>
                    <p>Welcome, ${name}</p>
                    <img src="${picture}" alt="User Avatar" />
                </body></html>
            `
        };

    } catch (error) {
        console.error("Authentication callback error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Authentication failed." })
        };
    }
};
