import 'dotenv/config'; // if using .env
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({}); // API key is picked from GEMINI_API_KEY

async function main() {
  try {
    // List models to check connectivity
    const models = await ai.models.list();
    console.log("Available models:", models);

    // Generate a simple text
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // pick a valid model from listModels output
      contents: "Say hello to the world in one sentence",
    });

    console.log("Generated text:", response.text);
  } catch (err) {
    console.error("Error testing Gemini:", err);
  }
}

main();
