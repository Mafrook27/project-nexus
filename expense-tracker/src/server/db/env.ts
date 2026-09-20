// Loads .env.local then .env for standalone CLI scripts (tsx). The Next.js
// runtime does this on its own, so this file is only imported by scripts.
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });
