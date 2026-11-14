// Publishes the immutable tracker builds as static files at /t/<version>/a.js
import { cpSync } from 'node:fs'
cpSync('packages/tracker/dist', 'public/t', { recursive: true })
