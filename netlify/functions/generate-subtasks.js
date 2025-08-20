const { GoogleGenerativeAI } = require("@google/generative-ai");

const AI_MODEL_NAME = 'gemini-2.5-flash';

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        if (!process.env.API_KEY) {
            console.error('API_KEY not found in environment variables');
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured on the server.' }) };
        }

        const { taskText } = JSON.parse(event.body);
        if (!taskText) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'taskText is required' }) };
        }

        const genAI = new GoogleGenerativeAI(process.env.API_KEY);
        const model = genAI.getGenerativeModel({ model: AI_MODEL_NAME });
        
        // Language-aware prompt for subtask generation
        const prompt = `You are a task breakdown assistant. Given the task "${taskText}", provide a JSON object with a "subtasks" key containing an array of 2-3 actionable subtasks. 
        
        CRITICAL: You MUST generate the subtasks in the EXACT SAME LANGUAGE as the input task. If the task is in English, respond in English. If the task is in German, respond in German. If the task is in Spanish, respond in Spanish, etc.
        
        Your response MUST be only the JSON object with no additional text.
        
        Examples:
        - Input: "Plan a birthday party" → {"subtasks": ["Book a venue", "Send invitations", "Order a cake"]}
        - Input: "Eine Geburtstagsparty planen" → {"subtasks": ["Einen Veranstaltungsort buchen", "Einladungen versenden", "Eine Torte bestellen"]}`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        let subtasks = [];
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsedResponse = JSON.parse(jsonMatch[0]);
                if (parsedResponse.subtasks && Array.isArray(parsedResponse.subtasks)) {
                    subtasks = parsedResponse.subtasks;
                }
            }
        } catch (parseError) {
            console.error('Failed to parse AI response:', responseText, parseError);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ subtasks: subtasks }),
        };
    } catch (error) {
        console.error('Error in Netlify function:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: `An internal server error occurred: ${error.message}` }),
        };
    }
};
