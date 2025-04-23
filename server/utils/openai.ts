/**
 * OpenAI Integration for IELTS Exam AI Scoring
 * 
 * This module provides the functionality for AI-assisted scoring of IELTS Writing and Speaking responses.
 * It handles both text analysis for writing responses and audio transcription + analysis for speaking responses.
 * 
 * The implementation uses OpenAI's GPT-4o model for scoring and Whisper for audio transcription,
 * following the official IELTS scoring criteria.
 * 
 * Features:
 * - Writing response scoring based on official IELTS criteria
 * - Audio transcription of speaking responses
 * - Speaking response scoring based on the transcribed text
 * - Detailed feedback generation with strengths and areas for improvement
 * 
 * Each scoring function returns:
 * - Overall band score (0-9 scale with 0.5 increments)
 * - Individual scores for each criterion
 * - Detailed feedback with specific examples from the response
 */

import OpenAI from "openai";
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Initialize OpenAI client with API key from environment variables
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// GPT-4o model configuration
// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const GPT_MODEL = "gpt-4o";
const WHISPER_MODEL = "whisper-1"; // OpenAI's audio transcription model

// IELTS scoring criteria for Writing
export const WRITING_CRITERIA = [
  "Task Achievement / Task Response",
  "Coherence and Cohesion",
  "Lexical Resource",
  "Grammatical Range and Accuracy",
];

// IELTS scoring criteria for Speaking
export const SPEAKING_CRITERIA = [
  "Fluency and Coherence",
  "Lexical Resource",
  "Grammatical Range and Accuracy",
  "Pronunciation",
];

/**
 * Scores a writing response using OpenAI's GPT-4o model based on IELTS criteria
 * 
 * @param prompt - The writing prompt/question given to the test-taker
 * @param response - The test-taker's written response to be scored
 * @returns A promise resolving to an object containing:
 *   - overallScore: The overall band score (0-9 with 0.5 increments)
 *   - criteriaScores: Individual scores for each IELTS writing criterion
 *   - feedback: Detailed feedback with strengths and areas for improvement
 * 
 * Implementation details:
 * - Uses GPT-4o with a specific system prompt to ensure consistent IELTS scoring
 * - Evaluates four criteria: Task Achievement, Coherence, Lexical Resource, and Grammar
 * - Returns structured JSON with detailed feedback for the test-taker
 * - Includes error handling with appropriate error messages
 */
export async function scoreWritingResponse(
  prompt: string,
  response: string
): Promise<{
  overallScore: number;
  criteriaScores: Record<string, number>;
  feedback: string;
}> {
  try {
    const promptText = prompt || "No prompt provided";
  
    // Call OpenAI API to analyze and score the writing response
    const completion = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        {
          role: "system",
          content: `You are an IELTS examiner analyzing a writing response. 
          Score the response on a scale of 0-9 for each of these criteria: ${WRITING_CRITERIA.join(
            ", "
          )}. 
          Provide an overall band score (0-9, can use .5 increments) and detailed feedback explaining strengths and areas for improvement. 
          Ensure your scoring aligns with official IELTS rubrics. 
          Respond with JSON in this format: 
          { 
            "overallScore": number, 
            "criteriaScores": { 
              "Task Achievement / Task Response": number, 
              "Coherence and Cohesion": number, 
              "Lexical Resource": number, 
              "Grammatical Range and Accuracy": number 
            }, 
            "feedback": "detailed feedback with specific examples from the text" 
          }`
        },
        {
          role: "user",
          content: `WRITING PROMPT: ${promptText}\n\nCANDIDATE RESPONSE: ${response}`
        }
      ],
      response_format: { type: "json_object" } // Ensure structured JSON response
    });

    // Extract and parse the JSON response
    const content = completion.choices[0].message.content || '{"overallScore":0,"criteriaScores":{},"feedback":"Failed to generate feedback"}';
    const result = JSON.parse(content);
    
    // Return the structured scoring result
    return {
      overallScore: result.overallScore,
      criteriaScores: result.criteriaScores,
      feedback: result.feedback
    };
  } catch (error) {
    console.error("Error scoring writing response:", error);
    throw new Error("Failed to score writing response");
  }
}

// Function to transcribe audio from speaking test
/**
 * Transcribes audio from a speaking response using OpenAI's Whisper model
 * 
 * @param audioBuffer - The buffer containing the audio data to transcribe
 * @returns A promise resolving to the transcribed text
 * 
 * Implementation details:
 * - Creates a temporary file in the OS temp directory to store the audio data
 * - Sends the file to OpenAI's Whisper model for transcription
 * - Cleans up the temporary file after transcription is complete
 * - Returns the transcribed text or throws an error if transcription fails
 */
export async function transcribeSpeakingAudio(
  audioBuffer: Buffer
): Promise<string> {
  try {
    // Create a temporary file to hold the audio data
    const tempFilePath = path.join(os.tmpdir(), `speech-${Date.now()}.mp3`);
    
    // Write the buffer to a temporary file
    fs.writeFileSync(tempFilePath, audioBuffer);
    
    // Use the file path with OpenAI's Whisper model
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: WHISPER_MODEL,
      language: "en", // Specify English language for better accuracy
    });
    
    // Clean up the temporary file
    try {
      fs.unlinkSync(tempFilePath);
    } catch (cleanupError) {
      console.error("Error cleaning up temp file:", cleanupError);
    }

    return transcription.text;
  } catch (error) {
    console.error("Error transcribing speaking audio:", error);
    throw new Error("Failed to transcribe speaking audio");
  }
}

/**
 * Scores a speaking response using OpenAI's GPT-4o model based on IELTS criteria
 * 
 * @param prompt - The speaking prompt/question given to the test-taker
 * @param transcription - The transcribed text of the test-taker's spoken response
 * @returns A promise resolving to an object containing:
 *   - overallScore: The overall band score (0-9 with 0.5 increments)
 *   - criteriaScores: Individual scores for each IELTS speaking criterion
 *   - feedback: Detailed feedback with strengths and areas for improvement
 * 
 * Implementation details:
 * - Uses GPT-4o with a specific system prompt to ensure consistent IELTS scoring
 * - Evaluates four criteria: Fluency and Coherence, Lexical Resource, Grammar, and Pronunciation
 * - Returns structured JSON with detailed feedback for the test-taker
 * - Includes error handling with appropriate error messages
 */
export async function scoreSpeakingResponse(
  prompt: string,
  transcription: string
): Promise<{
  overallScore: number;
  criteriaScores: Record<string, number>;
  feedback: string;
}> {
  try {
    const promptText = prompt || "No prompt provided";
    
    // Call OpenAI API to analyze and score the speaking response
    const completion = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        {
          role: "system",
          content: `You are an IELTS examiner analyzing a speaking response. 
          Score the transcribed response on a scale of 0-9 for each of these criteria: ${SPEAKING_CRITERIA.join(
            ", "
          )}. 
          Provide an overall band score (0-9, can use .5 increments) and detailed feedback explaining strengths and areas for improvement. 
          Ensure your scoring aligns with official IELTS rubrics.
          Respond with JSON in this format: 
          { 
            "overallScore": number, 
            "criteriaScores": { 
              "Fluency and Coherence": number, 
              "Lexical Resource": number, 
              "Grammatical Range and Accuracy": number, 
              "Pronunciation": number 
            }, 
            "feedback": "detailed feedback with specific examples from the response" 
          }`
        },
        {
          role: "user",
          content: `SPEAKING PROMPT: ${promptText}\n\nTRANSCRIPTION OF CANDIDATE RESPONSE: ${transcription}`
        }
      ],
      response_format: { type: "json_object" } // Ensure structured JSON response
    });

    // Extract and parse the JSON response
    const content = completion.choices[0].message.content || '{"overallScore":0,"criteriaScores":{},"feedback":"Failed to generate feedback"}';
    const result = JSON.parse(content);
    
    // Return the structured scoring result
    return {
      overallScore: result.overallScore,
      criteriaScores: result.criteriaScores,
      feedback: result.feedback
    };
  } catch (error) {
    console.error("Error scoring speaking response:", error);
    throw new Error("Failed to score speaking response");
  }
}