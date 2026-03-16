/**
 * useChatAPI - Hook para chat com Gemini (texto + function calling)
 * 
 * Features:
 * - REST API com Gemini 3.1 Flash Lite
 * - Function calling com tools (ghost_search, show_image, fetch_page, etc.)
 * - Loop de tool execution: se resposta tem functionCall → executar → enviar resultado → obter resposta final
 * - Thinking config para modelo lite
 * - TTS controlado externamente pelo App.tsx
 */

import { useState, useRef, useCallback } from 'react';
import { LiveConfig, ToolResult } from '../types';
import { buildFunctionDeclarations } from '../store/skillsStore';
import { handleToolCall } from '../utils/dataFunctions';

interface UseChatAPIResult {
  connected: boolean;
  isProcessing: boolean;
  transcript: string;
  toolResults: ToolResult[];
  sendMessage: (message: string) => Promise<string>;
  disconnect: () => void;
  connect: (config: LiveConfig) => Promise<boolean>;
}

// Configuração da API
const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Max tool call iterations to prevent infinite loops
const MAX_TOOL_ITERATIONS = 5;

export const useChatAPI = (): UseChatAPIResult => {
  const [connected, setConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [toolResults, setToolResults] = useState<ToolResult[]>([]);

  // Refs
  const apiKeyRef = useRef<string>('');
  const configRef = useRef<LiveConfig | null>(null);
  const historyRef = useRef<any[]>([]);

  // Conectar ao Gemini
  const connect = useCallback(async (config: LiveConfig) => {
    try {
      const apiKey = config.apiKey || (window as any).process?.env?.API_KEY || '';
      if (!apiKey) {
        throw new Error('API Key não encontrada');
      }

      apiKeyRef.current = apiKey;
      configRef.current = config;
      historyRef.current = [];
      setConnected(true);
      console.log('[ChatAPI] Conectado ao Gemini (REST API com function calling)');

      return true;
    } catch (error) {
      console.error('[ChatAPI] Erro ao conectar:', error);
      setConnected(false);
      return false;
    }
  }, []);

  // Enviar mensagem via REST API com function calling
  const sendMessage = useCallback(async (message: string): Promise<string> => {
    if (!connected || !apiKeyRef.current) {
      throw new Error('Chat não conectado');
    }

    setIsProcessing(true);

    const userLabel = 'User: ';
    const geminiLabel = 'Gemini: ';
    
    setTranscript((prev: string) => {
      return prev + (prev ? '\n' : '') + userLabel + message;
    });

    try {
      // Adicionar mensagem ao histórico
      historyRef.current.push({
        role: 'user',
        parts: [{ text: message }]
      });

      // Build function declarations from enabled skills
      const functionDeclarations = buildFunctionDeclarations();
      const hasTools = functionDeclarations.length > 0;

      // Loop de tool calling
      let iteration = 0;
      let finalResponse = '';

      while (iteration < MAX_TOOL_ITERATIONS) {
        iteration++;

        // Build request body
        const requestBody: any = {
          contents: historyRef.current,
          generationConfig: {
            temperature: 0.9,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 2048,
            // Thinking config para modelo lite
            thinkingConfig: {
              thinkingBudget: 1024
            }
          }
        };

        // Add system instruction
        if (configRef.current?.systemInstruction) {
          requestBody.systemInstruction = {
            role: 'system',
            parts: [{ text: configRef.current.systemInstruction }]
          };
        }

        // Add tools if available
        if (hasTools) {
          requestBody.tools = [{
            functionDeclarations
          }];
        }

        // Make API request
        const response = await fetch(
          `${GEMINI_API_URL}/models/${GEMINI_MODEL}:generateContent?key=${apiKeyRef.current}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        
        if (!candidate?.content?.parts) {
          console.warn('[ChatAPI] Resposta sem parts:', data);
          break;
        }

        const parts = candidate.content.parts;

        // Check for function calls
        const functionCalls = parts.filter((p: any) => p.functionCall);
        const textParts = parts.filter((p: any) => p.text);

        if (functionCalls.length > 0) {
          // Add model response with function calls to history
          historyRef.current.push({
            role: 'model',
            parts: parts
          });

          // Execute each function call
          const functionResponses: any[] = [];

          for (const part of functionCalls) {
            const call = part.functionCall;
            console.log('[ChatAPI] Function call:', call.name, call.args);

            // Emit search event for UI
            if (call.name === 'ghost_search') {
              window.dispatchEvent(new CustomEvent('livego:search_active', {
                detail: { query: call.args?.query || '' }
              }));
            }

            try {
              const result = await handleToolCall({
                name: call.name,
                args: call.args || {}
              });

              // Track tool result
              const toolResult: ToolResult = {
                toolName: call.name,
                query: call.args?.query || call.args?.url || '',
                timestamp: Date.now(),
                answer: typeof result === 'string' ? result : JSON.stringify(result)?.substring(0, 500),
                ok: result?.ok !== false,
              };
              setToolResults(prev => [...prev, toolResult]);

              functionResponses.push({
                functionResponse: {
                  name: call.name,
                  response: result || { ok: true }
                }
              });

              console.log('[ChatAPI] Function result:', call.name, result?.ok);
            } catch (toolError) {
              console.error('[ChatAPI] Tool error:', call.name, toolError);
              functionResponses.push({
                functionResponse: {
                  name: call.name,
                  response: { ok: false, error: String(toolError) }
                }
              });
            }

            // Emit search done for UI
            if (call.name === 'ghost_search') {
              window.dispatchEvent(new CustomEvent('livego:search_done', {
                detail: { query: call.args?.query || '' }
              }));
            }
          }

          // Add function responses to history
          historyRef.current.push({
            role: 'user',
            parts: functionResponses
          });

          // Continue loop to get final text response
          continue;
        }

        // No function calls — extract text response
        if (textParts.length > 0) {
          finalResponse = textParts.map((p: any) => p.text).join('');
        }

        // Add model response to history
        historyRef.current.push({
          role: 'model',
          parts: [{ text: finalResponse }]
        });

        break; // Exit loop — got text response
      }

      // Add response to transcript
      if (finalResponse) {
        setTranscript((prev: string) => prev + '\n' + geminiLabel + finalResponse);
      }

      return finalResponse;
    } catch (error) {
      console.error('[ChatAPI] Erro ao enviar mensagem:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [connected]);

  // Desconectar
  const disconnect = useCallback(() => {
    apiKeyRef.current = '';
    configRef.current = null;
    historyRef.current = [];
    setConnected(false);
    setTranscript('');
    setToolResults([]);
    console.log('[ChatAPI] Desconectado');
  }, []);

  return {
    connected,
    isProcessing,
    transcript,
    toolResults,
    sendMessage,
    disconnect,
    connect,
  };
};

export default useChatAPI;
