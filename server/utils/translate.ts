import OpenAI from "openai";
import { log } from "../vite";

// Initialize OpenAI if API key is available
let openai: OpenAI | null = null;

if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  log("OpenAI initialized for translation services", "translate");
} else {
  log("OPENAI_API_KEY not found in environment variables. Translation functionality will be disabled.", "translate");
}

/**
 * Translates text from English to Arabic using OpenAI's GPT-4o model
 * 
 * @param text - The English text to translate to Arabic
 * @returns A promise resolving to the translated Arabic text
 */
export async function translateToArabic(text: string): Promise<string> {
  if (!openai) {
    throw new Error("Translation service is not available: OpenAI not initialized");
  }
  
  if (!text || text.trim() === "") {
    return "";
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released after your knowledge cutoff. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a high-quality translator specializing in IELTS exam content. Translate the provided English text to formal, accurate Arabic while preserving academic terminology. Maintain the original formatting including paragraphs, bullet points, and numbering."
        },
        {
          role: "user",
          content: `Translate the following English text to Arabic:\n\n${text}`
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent translations
    });

    const translation = response.choices[0].message.content?.trim();
    
    if (!translation) {
      throw new Error("Translation service returned empty response");
    }
    
    return translation;
  } catch (error) {
    log(`Translation error: ${error instanceof Error ? error.message : String(error)}`, "translate");
    throw new Error(`Failed to translate text: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Translates text from Arabic to English using OpenAI's GPT-4o model
 * 
 * @param text - The Arabic text to translate to English
 * @returns A promise resolving to the translated English text
 */
export async function translateToEnglish(text: string): Promise<string> {
  if (!openai) {
    throw new Error("Translation service is not available: OpenAI not initialized");
  }
  
  if (!text || text.trim() === "") {
    return "";
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released after your knowledge cutoff. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a high-quality translator specializing in IELTS exam content. Translate the provided Arabic text to formal, accurate English while preserving academic terminology. Maintain the original formatting including paragraphs, bullet points, and numbering."
        },
        {
          role: "user",
          content: `Translate the following Arabic text to English:\n\n${text}`
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent translations
    });

    const translation = response.choices[0].message.content?.trim();
    
    if (!translation) {
      throw new Error("Translation service returned empty response");
    }
    
    return translation;
  } catch (error) {
    log(`Translation error: ${error instanceof Error ? error.message : String(error)}`, "translate");
    throw new Error(`Failed to translate text: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Translates transcribed audio text from English to Arabic
 * 
 * @param transcription - The English transcription from audio to translate
 * @returns A promise resolving to the translated Arabic text
 */
export async function translateTranscription(transcription: string): Promise<string> {
  return translateToArabic(transcription);
}