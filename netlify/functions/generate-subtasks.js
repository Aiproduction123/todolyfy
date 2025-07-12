const { GoogleGenerativeAI } = require("@google/generative-ai");

const AI_MODEL_NAME = 'gemini-1.5-flash';

exports.handler = async function(event, context) {
    console.log('Function called with method:', event.httpMethod);
    
    // Add CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        console.log('Handling OPTIONS request');
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        console.log('Invalid method:', event.httpMethod);
        return { 
            statusCode: 405, 
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        // Check if API key exists
        if (!process.env.API_KEY) {
            console.error('API_KEY not found in environment variables');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'API key not configured' })
            };
        }

        let taskText;
        try {
            const parsedBody = JSON.parse(event.body);
            taskText = parsedBody.taskText;
        } catch (parseError) {
            console.error('Error parsing request body:', parseError);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid JSON in request body' })
            };
        }

        if (!taskText) {
            console.log('No taskText provided');
            return { 
                statusCode: 400, 
                headers,
                body: JSON.stringify({ error: 'taskText is required' }) 
            };
        }

        console.log('Processing task:', taskText);

        const genAI = new GoogleGenerativeAI(process.env.API_KEY);
        const model = genAI.getGenerativeModel({ model: AI_MODEL_NAME });
        
        const prompt = `Break down this task into 2-4 smaller, actionable subtasks: "${taskText}"

Return only a JSON object with this exact format:
{
  "subtasks": ["subtask 1", "subtask 2", "subtask 3"]
}

Make sure each subtask is:
- Specific and actionable
- Can be completed in 15-30 minutes
- Clearly defined

Task: ${taskText}`;

        console.log('Calling AI model...');
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        console.log('AI response:', responseText);
        
        // Clean up the response to ensure it's valid JSON
        let cleanResponse = responseText.trim();
        if (cleanResponse.startsWith('```json')) {
            cleanResponse = cleanResponse.replace(/```json\n?/, '').replace(/\n?```$/, '');
        }
        
        let responseData;
        try {
            responseData = JSON.parse(cleanResponse);
            console.log('Parsed response:', responseData);
        } catch (parseError) {
            console.log('JSON parse failed, trying fallback parsing');
            // Fallback: try to extract subtasks from the response
            const lines = responseText.split('\n').filter(line => line.trim() && !line.includes('```'));
            const subtasks = lines.map(line => line.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
            
            if (subtasks.length === 0) {
                console.error('No valid subtasks found in AI response');
                throw new Error('No valid subtasks found in AI response');
            }
            
            responseData = { subtasks: subtasks.slice(0, 4) };
            console.log('Fallback parsed response:', responseData);
        }

        // Validate the response structure
        if (!responseData.subtasks || !Array.isArray(responseData.subtasks) || responseData.subtasks.length === 0) {
            console.error('Invalid response structure:', responseData);
            throw new Error('Invalid response structure from AI');
        }

        console.log('Returning success response');
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(responseData),
        };
    } catch (error) {
        console.error('Error in Netlify function:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: `Failed to generate subtasks: ${error.message}` }),
        };
    }
};