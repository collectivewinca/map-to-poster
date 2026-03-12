import { defineConfig } from 'vite';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default defineConfig({
	esbuild: {
		target: 'esnext',
	},
	optimizeDeps: {
		esbuildOptions: {
			target: 'esnext',
		},
	},
	build: {
		target: 'esnext',
		chunkSizeWarningLimit: 1100,
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes('node_modules/maplibre-gl')) return 'maplibre-gl';
					if (id.includes('node_modules/html2canvas')) return 'html2canvas';
					if (id.includes('node_modules/leaflet')) return 'leaflet';
				}
			}
		}
	},
	css: {
		postcss: {
			plugins: [
				tailwindcss({
					content: [
						"./index.html",
						"./main.js",
						"./src/**/*.{js,ts,jsx,tsx}",
					],
					theme: {
						extend: {
							colors: {
								background: '#f8f9fa',
								sidebar: '#ffffff',
							},
							fontFamily: {
								sans: ['Outfit', 'sans-serif'],
								serif: ['"Playfair Display"', 'serif'],
								mono: ['"Fira Code"', 'monospace'],
								poster: ['Outfit', 'sans-serif'],
							}
						},
					},
				}),
				autoprefixer(),
			],
		},
	}
});
