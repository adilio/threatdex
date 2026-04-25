/**
 * OpenAI DALL-E image provider (legacy).
 *
 * Model: dall-e-3
 * Cost: ~$0.04-$0.12/image (depending on quality)
 * Latency: ~10-15s
 * Quality: Good but expensive compared to Gemini
 */

import OpenAI from "openai"
import type { ImageProvider } from "./index.js"

interface OpenAIOptions {
  model?: "dall-e-2" | "dall-e-3"
  size?: "256x256" | "512x512" | "1024x1024" | "1792x1024" | "1024x1792"
  quality?: "standard" | "hd"
}

export function openAiProvider(options: OpenAIOptions = {}): ImageProvider {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not set")
  }

  const client = new OpenAI({ apiKey })
  const model = options.model ?? "dall-e-3"
  const size = options.size ?? "1024x1024"
  const quality = options.quality ?? "standard"

  return {
    name: `openai-${model}`,
    async generate(prompt: string): Promise<Buffer | null> {
      try {
        const result = await client.images.generate({
          model,
          prompt,
          n: 1,
          size,
          quality,
          response_format: "b64_json",
        })

        const b64 = result.data[0]?.b64_json
        if (!b64) {
          console.error("OpenAI returned no image data")
          return null
        }

        return Buffer.from(b64, "base64")
      } catch (error) {
        console.error("OpenAI image generation failed:", error)
        return null
      }
    },
  }
}
