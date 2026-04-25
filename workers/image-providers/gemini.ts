/**
 * Google Gemini Imagen 3 image provider.
 *
 * Model: imagen-3.0-generate-002
 * Cost: ~$0.04/image
 * Latency: ~10s
 * Quality: Best of available options
 */

import { GoogleGenerativeAI } from "@google/generative-ai"
import type { ImageProvider } from "./index.js"

interface GeminiOptions {
  size?: `${number}x${number}`
}

export function geminiProvider(_options: GeminiOptions = {}): ImageProvider {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set")
  }

  const client = new GoogleGenerativeAI(apiKey)

  return {
    name: "gemini-imagen-3",
    async generate(prompt: string): Promise<Buffer | null> {
      try {
        const model = client.getGenerativeModel({
          model: "imagen-3.0-generate-002",
        })

        const result = await model.generateContent([
          {
            inlineData: {
              mimeType: "text/plain",
              data: Buffer.from(prompt).toString("base64"),
            },
          },
        ])

        const b64 =
          result.response.candidates?.[0]?.content?.parts?.[0]?.inlineData
            ?.data
        if (!b64) {
          console.error("Gemini returned no image data")
          return null
        }

        return Buffer.from(b64, "base64")
      } catch (error) {
        console.error("Gemini image generation failed:", error)
        return null
      }
    },
  }
}
