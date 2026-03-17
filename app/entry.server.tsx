import { PassThrough } from "node:stream"
import type { AppLoadContext, EntryContext } from "react-router"
import { createReadableStreamFromReadable } from "@react-router/node"
import { ServerRouter } from "react-router"
import { renderToPipeableStream } from "react-dom/server"
import { isbot } from "isbot"

const ABORT_DELAY = 5_000

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext,
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false
    const userAgent = request.headers.get("user-agent")
    const isBot = userAgent ? isbot(userAgent) : false

    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        onShellReady() {
          shellRendered = true
          if (!isBot) {
            const body = new PassThrough()
            const stream = createReadableStreamFromReadable(body)
            responseHeaders.set("Content-Type", "text/html")
            resolve(
              new Response(stream, {
                headers: responseHeaders,
                status: responseStatusCode,
              }),
            )
            pipe(body)
          }
        },
        onAllReady() {
          if (isBot) {
            const body = new PassThrough()
            const stream = createReadableStreamFromReadable(body)
            responseHeaders.set("Content-Type", "text/html")
            resolve(
              new Response(stream, {
                headers: responseHeaders,
                status: responseStatusCode,
              }),
            )
            pipe(body)
          }
        },
        onShellError(error: unknown) {
          reject(error)
        },
        onError(error: unknown) {
          responseStatusCode = 500
          if (shellRendered) {
            console.error(error)
          }
        },
      },
    )
    setTimeout(abort, ABORT_DELAY)
  })
}
