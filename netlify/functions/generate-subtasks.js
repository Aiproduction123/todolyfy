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
        
        // A more direct prompt for the AI
        const prompt = `You are a task breakdown assistant. Given the task "${taskText}", provide a JSON object with a "subtasks" key containing an array of 2-4 actionable subtasks. Your response MUST be only the JSON object. Example: {"subtasks": ["Subtask 1", "Subtask 2"]}`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        // Robust JSON extraction
        let subtasks = [];
        try {
            // Find the JSON part of the response, even if the AI adds extra text
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsedResponse = JSON.parse(jsonMatch[0]);
                if (parsedResponse.subtasks && Array.isArray(parsedResponse.subtasks)) {
                    subtasks = parsedResponse.subtasks;
                }
            }
        } catch (parseError) {
            console.error('Failed to parse AI response:', responseText, parseError);
            // If parsing fails, we'll return an empty array, which the frontend handles gracefully.
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
