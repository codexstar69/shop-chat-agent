/**
 * Gemini Service
 * Manages interactions with Google's Gemini API
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import AppConfig from "./config.server";
import systemPrompts from "../prompts/prompts.json";

/**
 * Creates a Gemini service instance
 * @param {string} apiKey - Google AI API key
 * @returns {Object} Gemini service with methods for interacting with Gemini API
 */
export function createGeminiService(apiKey = process.env.GOOGLE_API_KEY) {
  // Initialize Gemini client
  const genAI = new GoogleGenerativeAI(apiKey);

  /**
   * Convert MCP tools to Gemini function declarations format
   * @param {Array} tools - MCP tools array
   * @returns {Array} Gemini function declarations
   */
  const convertToolsToFunctions = (tools) => {
    if (!tools || tools.length === 0) return undefined;

    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema || {
        type: "object",
        properties: {},
        required: []
      }
    }));
  };

  /**
   * Convert conversation history to Gemini format
   * @param {Array} messages - Conversation history in Claude format
   * @returns {Array} Gemini formatted history
   */
  const convertHistoryToGemini = (messages) => {
    const history = [];

    for (const msg of messages) {
      if (msg.role === 'user') {
        // Handle user messages
        if (Array.isArray(msg.content)) {
          // Check if it's a tool result
          const toolResult = msg.content.find(c => c.type === 'tool_result');
          if (toolResult) {
            history.push({
              role: 'function',
              parts: [{
                functionResponse: {
                  name: toolResult.tool_use_id,
                  response: { result: toolResult.content }
                }
              }]
            });
          } else {
            const textContent = msg.content.find(c => c.type === 'text');
            if (textContent) {
              history.push({
                role: 'user',
                parts: [{ text: textContent.text }]
              });
            }
          }
        } else {
          history.push({
            role: 'user',
            parts: [{ text: msg.content }]
          });
        }
      } else if (msg.role === 'assistant') {
        // Handle assistant messages
        if (Array.isArray(msg.content)) {
          const parts = [];
          for (const block of msg.content) {
            if (block.type === 'text') {
              parts.push({ text: block.text });
            } else if (block.type === 'tool_use') {
              parts.push({
                functionCall: {
                  name: block.name,
                  args: block.input
                }
              });
            }
          }
          if (parts.length > 0) {
            history.push({ role: 'model', parts });
          }
        } else {
          history.push({
            role: 'model',
            parts: [{ text: msg.content }]
          });
        }
      }
    }

    return history;
  };

  /**
   * Streams a conversation with Gemini
   * @param {Object} params - Stream parameters
   * @param {Array} params.messages - Conversation history
   * @param {string} params.promptType - The type of system prompt to use
   * @param {Array} params.tools - Available tools for Gemini
   * @param {Object} streamHandlers - Stream event handlers
   * @returns {Promise<Object>} The final message
   */
  const streamConversation = async ({
    messages,
    promptType = AppConfig.api.defaultPromptType,
    tools
  }, streamHandlers) => {
    // Get system prompt from configuration
    const systemInstruction = getSystemPrompt(promptType);

    // Get the model with configuration
    const model = genAI.getGenerativeModel({
      model: AppConfig.api.defaultModel,
      systemInstruction: systemInstruction,
      generationConfig: {
        maxOutputTokens: AppConfig.api.maxTokens,
      },
      tools: tools && tools.length > 0 ? [{
        functionDeclarations: convertToolsToFunctions(tools)
      }] : undefined,
    });

    // Convert history (exclude the last user message as we'll send it separately)
    const history = convertHistoryToGemini(messages.slice(0, -1));

    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    let userContent = '';
    if (Array.isArray(lastMessage.content)) {
      const textBlock = lastMessage.content.find(c => c.type === 'text');
      userContent = textBlock ? textBlock.text : '';
    } else {
      userContent = lastMessage.content;
    }

    // Start chat session
    const chat = model.startChat({ history });

    // Send message with streaming
    const result = await chat.sendMessageStream(userContent);

    let fullText = '';
    const contentBlocks = [];
    let hasToolUse = false;

    // Process the stream
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        fullText += chunkText;
        if (streamHandlers.onText) {
          streamHandlers.onText(chunkText);
        }
      }

      // Check for function calls
      const candidates = chunk.candidates || [];
      for (const candidate of candidates) {
        const parts = candidate.content?.parts || [];
        for (const part of parts) {
          if (part.functionCall) {
            hasToolUse = true;
            const toolUseBlock = {
              type: 'tool_use',
              id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: part.functionCall.name,
              input: part.functionCall.args || {}
            };
            contentBlocks.push(toolUseBlock);

            if (streamHandlers.onToolUse) {
              await streamHandlers.onToolUse(toolUseBlock);
            }
          }
        }
      }
    }

    // Add text content if present
    if (fullText) {
      contentBlocks.unshift({ type: 'text', text: fullText });
    }

    // Build the final message in Claude-compatible format
    const finalMessage = {
      role: 'assistant',
      content: contentBlocks.length > 0 ? contentBlocks : [{ type: 'text', text: fullText }],
      stop_reason: hasToolUse ? 'tool_use' : 'end_turn'
    };

    // Call message handler
    if (streamHandlers.onMessage) {
      streamHandlers.onMessage(finalMessage);
    }

    // Call content block complete handler
    if (streamHandlers.onContentBlock && fullText) {
      streamHandlers.onContentBlock({ type: 'text', text: fullText });
    }

    return finalMessage;
  };

  /**
   * Gets the system prompt content for a given prompt type
   * @param {string} promptType - The prompt type to retrieve
   * @returns {string} The system prompt content
   */
  const getSystemPrompt = (promptType) => {
    return systemPrompts.systemPrompts[promptType]?.content ||
      systemPrompts.systemPrompts[AppConfig.api.defaultPromptType].content;
  };

  return {
    streamConversation,
    getSystemPrompt
  };
}

export default {
  createGeminiService
};
