
const { GoogleGenAI, Type } = require("@google/genai");

const AI_MODEL_NAME = 'gemini-2.5-flash';
// Your API key is securely accessed from Netlify's environment variables
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { taskText } = JSON.parse(event.body);
        if (!taskText) {
            return { statusCode: 400, body: JSON.stringify({ error: 'taskText is required' }) };
        }

        const prompt = `Based on the complexity of the task "${taskText}", break it down into 1 to 3 smaller, actionable subtasks. Simple tasks should have fewer subtasks.`;
        
        const response = await ai.models.generateContent({
            model: AI_MODEL_NAME,
            contents: prompt,
            config: {
                systemInstruction: "You are an expert at breaking down large tasks into smaller, actionable steps.",
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    subtasks: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ['subtasks']
                },
            },
        });
        
        const responseData = JSON.parse(response.text);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(responseData),
        };
    } catch (error) {
        console.error('Error in Netlify function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to generate subtasks.' }),
        };
    }
};
