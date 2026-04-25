/**
 * Stable Horde image provider.
 *
 * Model: Community-powered (various Stable Diffusion models)
 * Cost: Free
 * Latency: 30s-5min (depends on queue)
 * Quality: Variable (lottery)
 */

import type { ImageProvider } from "./index.js"

interface StableHordeOptions {
  model?: string
}

const DEFAULT_MODEL = "Deliberate"

export function stableHordeProvider(options: StableHordeOptions = {}): ImageProvider {
  const apiKey = process.env.STABLE_HORDE_API_KEY
  if (!apiKey) {
    throw new Error("STABLE_HORDE_API_KEY not set")
  }

  const model = options.model ?? DEFAULT_MODEL
  const baseUrl = "https://stablehorde.net/api/v2"

  return {
    name: "stable-horde",
    async generate(prompt: string): Promise<Buffer | null> {
      try {
        // Submit generation request
        const submitResponse = await fetch(`${baseUrl}/generate/async`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: apiKey,
          },
          body: JSON.stringify({
            prompt,
            params: {
              sampler_name: "k_euler_a",
              cfg_scale: 7,
              width: 512,
              height: 512,
              steps: 30,
            },
            models: [model],
            nsfw: false,
            censor_nsfw: true,
            r2: true,
          }),
        })

        if (!submitResponse.ok) {
          console.error("Stable Horde submit failed:", await submitResponse.text())
          return null
        }

        const submitData = await submitResponse.json() as { id: string }
        const requestId = submitData.id

        // Poll for completion
        const maxWait = 300_000 // 5 minutes
        const startTime = Date.now()

        while (Date.now() - startTime < maxWait) {
          await new Promise((resolve) => setTimeout(resolve, 5000))

          const checkResponse = await fetch(`${baseUrl}/generate/check/${requestId}`)
          if (!checkResponse.ok) continue

          const checkData = await checkResponse.json() as { done: boolean }

          if (checkData.done) {
            // Fetch the result
            const resultResponse = await fetch(`${baseUrl}/generate/${requestId}`)
            if (!resultResponse.ok) {
              console.error("Stable Horde result fetch failed")
              return null
            }

            const resultData = await resultResponse.json() as { generations: Array<{ img: string }> }
            if (!resultData.generations?.[0]?.img) {
              console.error("Stable Horde returned no image")
              return null
            }

            // The img field is a base64 string
            return Buffer.from(resultData.generations[0].img, "base64")
          }
        }

        console.error("Stable Horde timed out")
        return null
      } catch (error) {
        console.error("Stable Horde image generation failed:", error)
        return null
      }
    },
  }
}
