import OpenAI from "openai";
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// GPT-4o model (most recent model as of May 2024)
// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const GPT_MODEL = "gpt-4o";

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

// Function to score a writing response
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
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0].message.content || '{"overallScore":0,"criteriaScores":{},"feedback":"Failed to generate feedback"}';
    const result = JSON.parse(content);
    
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
export async function transcribeSpeakingAudio(
  audioBuffer: Buffer
): Promise<string> {
  try {
    // Create a temporary file to hold the audio data
    const tempFilePath = path.join(os.tmpdir(), `speech-${Date.now()}.mp3`);
    
    // Write the buffer to a temporary file
    fs.writeFileSync(tempFilePath, audioBuffer);
    
    // Use the file path with OpenAI
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: "whisper-1",
      language: "en",
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

// Function to score a speaking response
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
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0].message.content || '{"overallScore":0,"criteriaScores":{},"feedback":"Failed to generate feedback"}';
    const result = JSON.parse(content);
    
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