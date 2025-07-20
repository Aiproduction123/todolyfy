import { google } from 'googleapis';

// Use the clean redirect URI defined in netlify.toml
const OAUTH2_REDIRECT_URI = `${process.env.URL}/auth/callback`;

export const handler = async function(event, context) {
    
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        OAUTH2_REDIRECT_URI
    );

    const scopes = [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
    ];

    const authorizationUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        include_granted_scopes: true
    });

    return {
        statusCode: 302,
        headers: {
            Location: authorizationUrl,
            'Cache-Control': 'no-cache' 
        },
        body: ''
    };
};
