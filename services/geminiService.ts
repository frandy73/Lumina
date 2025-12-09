
import { GoogleGenAI, Type } from "@google/genai";
import { Document, Flashcard, QuizQuestion, MindMapNode, Citation } from '../types';

// Helper to get Gemini Client lazily
const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to construct the file part
const getFilePart = (base64Data: string, mimeType: string = 'application/pdf') => {
  const data = base64Data.split(',')[1] || base64Data;
  return {
    inlineData: {
      data,
      mimeType
    }
  };
};

const LANG_INSTRUCTION = "Generate the response in the dominant language of the document. If the document is in French, use French. If uncertain or mixed, default to French.";

// --- Summary & Analysis ---

export const generateTailoredSummary = async (doc: Document, type: string, lang: string): Promise<string> => {
  let prompt = "";
  const langName = lang === 'fr' ? 'French' : lang === 'ht' ? 'Haitian Creole (Kreyòl Ayisyen)' : 'English';

  switch (type) {
    case 'simple':
      prompt = `Provide a simple, accessible summary of this document suitable for a beginner. Use clear language. Output language: ${langName}.`;
      break;
    case 'analytical':
      prompt = `Provide a professional analytical summary. Focus on methodology, data analysis, and critical implications. Output language: ${langName}.`;
      break;
    case 'pedagogical':
      prompt = `Act as a professor. Summarize this document with a focus on teaching the core concepts to a student. Output language: ${langName}.`;
      break;
    case 'concrete':
      prompt = `Summarize the practical applications and concrete examples found in this document. How can this be applied in real life? Output language: ${langName}.`;
      break;
    default:
      prompt = `Provide a comprehensive summary. Output language: ${langName}.`;
  }

  try {
    const response = await getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          getFilePart(doc.base64Data, doc.type),
          { text: prompt }
        ]
      },
      config: { temperature: 0.3 }
    });
    return response.text || "Échec de la génération du résumé.";
  } catch (error) {
    console.error("Summary Error:", error);
    throw error;
  }
};

export const generateMindMap = async (doc: Document): Promise<MindMapNode> => {
  try {
    const response = await getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          getFilePart(doc.base64Data, doc.type),
          { text: `Generate a hierarchical mind map structure of the key concepts in this document. Return strictly a JSON object with 'label' and 'children' (array of same objects). Use the dominant language of the document for the labels (default to French if uncertain).` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            children: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  children: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { label: {type: Type.STRING} } } } // Depth 2
                }
              }
            }
          }
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Mindmap Error:", error);
    throw error;
  }
};

export const generateStrategicAnalysis = async (doc: Document): Promise<string> => {
  try {
    const response = await getAi().models.generateContent({
      model: 'gemini-3-pro-preview', // Using Pro for deeper reasoning
      contents: {
        parts: [
          getFilePart(doc.base64Data, doc.type),
          { text: `Perform a strategic analysis of this document. Extract the Main Thesis, Key Objectives, Critical Arguments, and Major Conclusions. Format as Markdown. ${LANG_INSTRUCTION}` }
        ]
      }
    });
    return response.text || "Échec de l'analyse.";
  } catch (error) {
    console.error("Strategy Error:", error);
    throw error;
  }
};

export const generateKeyCitations = async (doc: Document): Promise<Citation[]> => {
  try {
    const response = await getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          getFilePart(doc.base64Data, doc.type),
          { text: `Extract 5-8 verbatim key citations from the document that are impactful. Include the context and author if available. The context explanation must be in the dominant language of the document (default to French).` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: "The direct quote" },
              author: { type: Type.STRING, description: "Who said it (or document section)" },
              context: { type: Type.STRING, description: "Why this quote is important (in doc language or French)" }
            }
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Citation Error:", error);
    throw error;
  }
};

// --- Resources ---

export const generateStudyGuide = async (doc: Document): Promise<string> => {
  try {
    const response = await getAi().models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          getFilePart(doc.base64Data, doc.type),
          { text: `Create a structured study guide for this document. Include: 1. Learning Objectives, 2. Key Definitions, 3. Chapter-by-Chapter Breakdown, 4. Summary Checklist. Format as Markdown. ${LANG_INSTRUCTION}` }
        ]
      }
    });
    return response.text || "Échec de la génération du guide.";
  } catch (error) {
    console.error("Study Guide Error:", error);
    throw error;
  }
};

export const generateFAQ = async (doc: Document): Promise<{question:string, answer:string}[]> => {
  try {
    const response = await getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          getFilePart(doc.base64Data, doc.type),
          { text: `Generate the top 8 most important Frequently Asked Questions (FAQ) to understand this document. ${LANG_INSTRUCTION}` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              answer: { type: Type.STRING }
            }
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("FAQ Error:", error);
    throw error;
  }
};

// --- Interactive ---

export const chatWithDocument = async (doc: Document, history: { role: string, parts: { text: string }[] }[], newMessage: string) => {
  try {
    const chat = getAi().chats.create({
      model: 'gemini-2.5-flash',
      history: [
        {
          role: 'user',
          parts: [
            getFilePart(doc.base64Data, doc.type),
            { text: `I have uploaded this document. I will ask you questions about it. Answer strictly based on the provided document context. Respond in the dominant language of the document or in French if uncertain. At the end of your response, provide 3 short suggested follow-up questions for the user in a separate JSON block if possible, or just plain text.` }
          ]
        },
        {
          role: 'model',
          parts: [{ text: "Understood. I will answer based on the document and suggest follow-up questions in the appropriate language." }]
        },
        ...history
      ]
    });

    const response = await chat.sendMessage({ message: newMessage + " (Remember to suggest 3 follow up questions at the very end labelled 'SUGGESTED_QUESTIONS: [...]')" });
    return response.text || "Je n'ai pas pu générer de réponse.";
  } catch (error) {
    console.error("Chat Error:", error);
    throw error;
  }
};

export const rewriteText = async (text: string, mode: 'bullet' | 'paragraph' | 'shorter' | 'longer'): Promise<string> => {
  let prompt = "";
  switch(mode) {
    case 'bullet': prompt = "Convert the following text into a clear bulleted list. Keep the formatting clean."; break;
    case 'paragraph': prompt = "Convert the following text into a cohesive, well-structured single paragraph."; break;
    case 'shorter': prompt = "Rewrite the following text to be more concise and shorter, while keeping the main meaning."; break;
    case 'longer': prompt = "Expand on the following text to be more detailed and comprehensive, adding necessary context or explanation."; break;
  }

  try {
    const response = await getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: `${prompt}\n\nTEXT:\n"${text}"` }
        ]
      }
    });
    return response.text || text;
  } catch (error) {
    console.error("Rewrite Error:", error);
    return text;
  }
};

export const generateFlashcards = async (doc: Document, count: number = 10): Promise<Flashcard[]> => {
  try {
    const response = await getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          getFilePart(doc.base64Data, doc.type),
          { text: `Generate ${count} study flashcards based on the most important concepts. Return JSON. ${LANG_INSTRUCTION}` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              front: { type: Type.STRING },
              back: { type: Type.STRING }
            },
            required: ["front", "back"]
          }
        }
      }
    });

    const rawData = JSON.parse(response.text || "[]");
    return rawData.map((item: any, index: number) => ({
      id: `fc-${Date.now()}-${index}`,
      front: item.front,
      back: item.back,
      isFavorite: false
    }));
  } catch (error) {
    console.error("Flashcard Gen Error:", error);
    throw error;
  }
};

export const generateQuiz = async (doc: Document, count: number, topic?: string): Promise<QuizQuestion[]> => {
  try {
    const topicPrompt = topic ? `Focus specifically on the topic/chapter: "${topic}".` : "Cover the entire document.";
    
    const response = await getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          getFilePart(doc.base64Data, doc.type),
          { text: `Generate a multiple-choice quiz with exactly ${count} questions. ${topicPrompt} Vary the difficulty. ${LANG_INSTRUCTION}` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Array of 4 possible answers"
              },
              correctAnswerIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING }
            },
            required: ["question", "options", "correctAnswerIndex", "explanation"]
          }
        }
      }
    });

    const rawData = JSON.parse(response.text || "[]");
    return rawData.map((item: any, index: number) => ({
      id: index,
      question: item.question,
      options: item.options,
      correctAnswerIndex: item.correctAnswerIndex,
      explanation: item.explanation
    }));
  } catch (error) {
    console.error("Quiz Gen Error:", error);
    throw error;
  }
};

export const generateQuizFromChat = async (doc: Document, chatHistory: {role: string, text: string}[]): Promise<QuizQuestion[]> => {
  try {
    const historyText = chatHistory.map(m => `${m.role}: ${m.text}`).join('\n\n');
    
    const response = await getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          getFilePart(doc.base64Data, doc.type),
          { text: `Based on the following chat conversation about the document, generate a short multiple-choice quiz (3-5 questions) to test the user's understanding of the *specific topics discussed in the chat*.
          
          CHAT HISTORY:
          ${historyText}
          
          ${LANG_INSTRUCTION}` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Array of 4 possible answers"
              },
              correctAnswerIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING }
            },
            required: ["question", "options", "correctAnswerIndex", "explanation"]
          }
        }
      }
    });

    const rawData = JSON.parse(response.text || "[]");
    return rawData.map((item: any, index: number) => ({
      id: index,
      question: item.question,
      options: item.options,
      correctAnswerIndex: item.correctAnswerIndex,
      explanation: item.explanation
    }));
  } catch (error) {
    console.error("Chat Quiz Gen Error:", error);
    throw error;
  }
};

export const explainConcept = async (doc: Document, concept: string): Promise<string> => {
  try {
    const response = await getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          getFilePart(doc.base64Data, doc.type),
          { text: `Explain the concept of "${concept}" in detail based on the document. ${LANG_INSTRUCTION}` }
        ]
      }
    });
    return response.text || "Impossible de générer une explication.";
  } catch (error) {
    console.error("Explainer Error:", error);
    throw error;
  }
};
