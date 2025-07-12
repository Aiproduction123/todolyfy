const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

const AI_MODEL_NAME = 'gemini-1.5-flash';
// Your API key is securely accessed from Netlify's environment variables
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { taskText } = JSON.parse(event.body);
        if (!taskText) {
            return { statusCode: 400, body: JSON.stringify({ error: 'taskText is required' }) };
        }

        const model = genAI.getGenerativeModel({
            model: AI_MODEL_NAME,
            systemInstruction: "You are an expert at breaking down large tasks into smaller, actionable steps.",
        });
        
        const generationConfig = {
            responseMimeType: "application/json",
        };

        const safetySettings = [
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
        ];

        const chat = model.startChat({
            generationConfig,
            safetySettings,
            history: [],
        });

        const prompt = `Based on the complexity of the task "${taskText}", break it down into 1 to 3 smaller, actionable subtasks. Simple tasks should have fewer subtasks.`;
        
        const result = await chat.sendMessage(prompt);
        const response = result.response;
        const responseData = JSON.parse(response.text());

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