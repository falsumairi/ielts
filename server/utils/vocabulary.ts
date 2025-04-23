import OpenAI from "openai";
import { CEFRLevel } from "@shared/schema";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const MODEL = "gpt-4o";

/**
 * Analyze a word using OpenAI to get CEFR level, meaning, word family, example, and Arabic translation
 * 
 * @param word The word to analyze
 * @returns An object containing the analysis results
 */
export async function analyzeVocabulary(word: string): Promise<{
  cefrLevel: CEFRLevel;
  meaning: string;
  wordFamily: string;
  example: string;
  arabicMeaning: string;
}> {
  try {
    const prompt = `Analyze the English word "${word}" and provide the following information:
1. CEFR Level (A1, A2, B1, B2, C1, or C2)
2. English meaning (clear and concise definition)
3. Word family (related words including different forms - nouns, verbs, adjectives, etc.)
4. Example sentence showing proper usage
5. Arabic translation of the word

Please respond in JSON format with these fields:
{
  "cefrLevel": "one of: A1, A2, B1, B2, C1, C2",
  "meaning": "definition",
  "wordFamily": "related words",
  "example": "example sentence",
  "arabicMeaning": "Arabic translation"
}`;

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    // Parse the response content
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Failed to get analysis from OpenAI");
    }

    const analysis = JSON.parse(content);

    // Validate CEFR level
    if (!Object.values(CEFRLevel).includes(analysis.cefrLevel as CEFRLevel)) {
      throw new Error("Invalid CEFR level in response");
    }

    return {
      cefrLevel: analysis.cefrLevel as CEFRLevel,
      meaning: analysis.meaning,
      wordFamily: analysis.wordFamily,
      example: analysis.example,
      arabicMeaning: analysis.arabicMeaning
    };
  } catch (error) {
    console.error("Error analyzing vocabulary with OpenAI:", error);
    throw new Error("Failed to analyze vocabulary. Please try again.");
  }
}