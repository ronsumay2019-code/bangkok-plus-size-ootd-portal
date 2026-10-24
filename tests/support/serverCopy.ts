// Starts one copy of the portal API (like one Vercel instance) on the port given in TEST_PORT.
// Run with VERCEL=1 so server.ts does not start Vite or its own listener.
import app from '../../server';

const port = Number(process.env.TEST_PORT);
app.listen(port, '127.0.0.1', () => {
  console.log(`server copy ready on ${port}`);
});
