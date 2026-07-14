import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("getting-started", "routes/getting-started.tsx"),
  route("api", "routes/api.tsx"),
  route("examples", "routes/examples.tsx"),
  route("playground", "routes/playground.tsx"),
  // Reached via GitHub Pages' 404.html (the SPA fallback), never prerendered.
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
