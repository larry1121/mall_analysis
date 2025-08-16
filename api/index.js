// Vercel Serverless Function Wrapper
import '../dist/index.js';

export default async function handler(req, res) {
  // This wrapper is needed for Vercel serverless functions
  // The actual API logic is in dist/index.js
  
  // Note: You'll need to adapt your Fastify app to work with Vercel's serverless functions
  // Consider using @vercel/node or restructuring to use Next.js API routes
  
  res.status(200).json({ 
    message: 'API endpoint - Please configure serverless functions properly',
    note: 'This project requires backend services (Redis, Worker) that cannot run on Vercel directly'
  });
}