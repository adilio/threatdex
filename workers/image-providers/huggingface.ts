/**
 * Hugging Face Inference image provider.
 *
 * Models: black-forest-labs/FLUX.1-schnell by default, override with HF_IMAGE_MODEL.
 * Cost: Free tier available
 * Latency: 20-60s (queued)
 * Quality: Good with FLUX, mid with SDXL
 */

import type { ImageProvider } from "./index.js"
import { InferenceClient } from "@huggingface/inference"

interface HuggingFaceOptions {
  model?: string
}

const DEFAULT_MODEL = process.env.HF_IMAGE_MODEL ?? "black-forest-labs/FLUX.1-schnell"

export function huggingFaceProvider(options: HuggingFaceOptions = {}): ImageProvider {
  const apiKey = process.env.HF_API_KEY
  if (!apiKey) {
    throw new Error("HF_API_KEY not set")
  }

  const model = options.model ?? DEFAULT_MODEL
  const client = new InferenceClient(apiKey)

  return {
    name: `huggingface-${model.split("/")[1]}`,
    async generate(prompt: string): Promise<Buffer | null> {
      try {
        const image = await client.textToImage(
          {
            model,
            inputs: prompt,
            provider: "auto",
          parameters: {
              num_inference_steps: model.includes("schnell") ? 4 : 25,
              guidance_scale: model.includes("schnell") ? 0 : 7.5,
            },
          },
          { outputType: "blob" }
        )

        return Buffer.from(await image.arrayBuffer())
      } catch (error) {
        console.error("Hugging Face image generation failed:", error)
        return null
      }
    },
  }
}
