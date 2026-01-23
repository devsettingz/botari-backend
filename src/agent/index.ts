// botari-api/src/agent/index.ts

export function processMessage(text: string): string {
  if (text.toLowerCase().includes("hello")) {
    return "Hi! Botari AI here to assist you.";
  }
  return `You said: ${text}`;
}
