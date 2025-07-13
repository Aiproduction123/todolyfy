import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// Use the stable 'gemini-pro' model to ensure availability and multilingual support
const AI_MODEL_NAME = 'gemini-2.5-flash';
const API_KEY = process.env.API_KEY;

const genAI = new GoogleGenerativeAI(API_KEY);

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
            safetySettings,
            history: [],
        });

        // --- NEW: Updated prompt for multilingual support ---
        const prompt = `First, detect the language of the following task. Then, based on its complexity, break it down into 1 to 3 smaller, actionable subtasks in that same language.
Task: "${taskText}"
IMPORTANT: Respond with only a valid JSON array of strings, like ["subtask 1", "subtask 2"].`;

        const result = await chat.sendMessage(prompt);
        const response = result.response;
        
        // Reliably extract JSON from the AI's response
        const rawText = response.text();
        const match = rawText.match(/\[.*\]/s);
        
        let responseData = []; // Default to an empty array

        if (match && match[0]) {
            try {
                responseData = JSON.parse(match[0]);
            } catch (jsonError) {
                console.error("Failed to parse JSON from AI response:", jsonError);
            }
        }

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
