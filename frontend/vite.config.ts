import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	server: {
		proxy: {
			'/dataset': {  // This MUST match the beginning of the URL in fetch
				target: 'http://localhost:4321', // Your backend URL
				changeOrigin: true, // Important for avoiding CORS issues
			},
			'/query': { //You need to proxy other routes as well
				target: 'http://localhost:4321',
				changeOrigin: true,
			},
			'/datasets': {
				target: 'http://localhost:4321',
				changeOrigin: true,
			},
		},
	},
});
