/** @type {import("next").NextConfig} */
const isGithubActions = process.env.GITHUB_ACTIONS === "true";
const repoName = "formula-racing-3d";

const nextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath: isGithubActions ? `/${repoName}` : "",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
