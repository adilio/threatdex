/**
 * Image generation provider abstraction.
 *
 * Supports multiple image generation providers:
 * - Hugging Face Inference (free tier available)
 * - Stable Horde (free, community-powered)
 * - OpenAI DALL-E (legacy, for compatibility)
 */

export interface ImageProvider {
  name: string
  generate(prompt: string): Promise<Buffer | null>
}

export interface ImageProviderOptions {
  size?: `${number}x${number}`
  quality?: "standard" | "hd"
  style?: "vivid" | "natural"
}

/**
 * Select an available image provider based on environment variables.
 *
 * Provider precedence:
 * 1. Hugging Face (HF_API_KEY) - good quality with FLUX models
 * 2. Stable Horde (STABLE_HORDE_API_KEY) - free but variable quality/latency
 * 3. OpenAI DALL-E (OPENAI_API_KEY) - legacy support
 */
export async function selectProvider(): Promise<ImageProvider> {
  if (process.env.HF_API_KEY) {
    const { huggingFaceProvider } = await import("./huggingface.js")
    return huggingFaceProvider()
  }
  if (process.env.STABLE_HORDE_API_KEY) {
    const { stableHordeProvider } = await import("./stable-horde.js")
    return stableHordeProvider()
  }
  if (process.env.OPENAI_API_KEY) {
    const { openAiProvider } = await import("./openai.js")
    return openAiProvider()
  }
  throw new Error(
    "No image provider API key found. Set one of: HF_API_KEY, STABLE_HORDE_API_KEY, or OPENAI_API_KEY"
  )
}

/**
 * Select a specific provider by name.
 * Useful for --provider CLI flag override.
 */
export async function getProviderByName(name: string): Promise<ImageProvider | null> {
  switch (name.toLowerCase()) {
    case "hf":
    case "huggingface":
      if (process.env.HF_API_KEY) {
        const { huggingFaceProvider } = await import("./huggingface.js")
        return huggingFaceProvider()
      }
      return null
    case "horde":
    case "stable-horde":
      if (process.env.STABLE_HORDE_API_KEY) {
        const { stableHordeProvider } = await import("./stable-horde.js")
        return stableHordeProvider()
      }
      return null
    case "openai":
    case "dall-e":
      if (process.env.OPENAI_API_KEY) {
        const { openAiProvider } = await import("./openai.js")
        return openAiProvider()
      }
      return null
    default:
      return null
  }
}
