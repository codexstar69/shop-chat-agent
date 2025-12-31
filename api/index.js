export const config = {
  runtime: 'nodejs'
};

export default async function handler(req, res) {
  // Import the built server
  const { createRequestHandler } = await import("@react-router/node");
  const build = await import("../build/server/index.js");

  const requestHandler = createRequestHandler({ build });
  return requestHandler(req, res);
}
