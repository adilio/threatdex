/**
 * Hugging Face Inference image provider.
 *
 * Models: stabilityai/stable-diffusion-xl-base-1.0 or black-forest-labs/FLUX.1-dev
 * Cost: Free tier available
 * Latency: 20-60s (queued)
 * Quality: Good with FLUX, mid with SDXL
 */

import type { ImageProvider } from "./index.js"

interface HuggingFaceOptions {
  model?: string
}

const DEFAULT_MODEL = "black-forest-labs/FLUX.1-dev"

export function huggingFaceProvider(options: HuggingFaceOptions = {}): ImageProvider {
  const apiKey = process.env.HF_API_KEY
  if (!apiKey) {
    throw new Error("HF_API_KEY not set")
  }

  const model = options.model ?? DEFAULT_MODEL

  return {
    name: `huggingface-${model.split("/")[1]}`,
    async generate(prompt: string): Promise<Buffer | null> {
      try {
        const response = await fetch(
          `https://api-inference.huggingface.co/models/${model}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              inputs: prompt,
              parameters: {
                num_inference_steps: 25,
                guidance_scale: 7.5,
              },
            }),
            signal: AbortSignal.timeout(120_000), // 2 minute timeout
          }
        )

        if (!response.ok) {
          const error = await response.text()
          console.error("Hugging Face API error:", error)
          return null
        }

        const buffer = Buffer.from(await response.arrayBuffer())
        return buffer
      } catch (error) {
        console.error("Hugging Face image generation failed:", error)
        return null
      }
    },
  }
}
