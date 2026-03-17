import { type RouteConfig, index, route } from "@react-router/dev/routes"

export default [
  index("routes/_index.tsx"),
  route("actors/:id", "routes/actors.$id.tsx"),
] satisfies RouteConfig
