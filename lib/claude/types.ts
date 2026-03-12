export interface ClaudeMessage {
  role: "user" | "assistant";
  content: ClaudeContent[];
}

export type ClaudeContent =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: {
        type: "base64";
        media_type: "image/png" | "image/jpeg" | "image/webp";
        data: string;
      };
    };

export interface ClaudeResponse {
  content: { type: "text"; text: string }[];
  usage: { input_tokens: number; output_tokens: number };
}
