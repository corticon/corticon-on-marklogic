import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function getPackageName(id) {
	const nodeModulesSegment = id.split('node_modules/')[1]

	if (!nodeModulesSegment) {
		return null
	}

	const parts = nodeModulesSegment.split('/')
	if (parts[0].startsWith('@')) {
		return `${parts[0]}/${parts[1]}`
	}

	return parts[0]
}

function sanitizeChunkName(name) {
	return name.replace('@', '').replace(/[\/]/g, '-')
}

function manualChunks(id) {
	if (!id.includes('node_modules')) {
		return undefined
	}

	const markdownPackages = ['react-markdown', 'remark-', 'mdast', 'micromark', 'hast']
	const packageName = getPackageName(id)

	if (!packageName) {
		return 'vendor'
	}

	if (packageName === 'ml-fasttrack') {
		return 'fasttrack-core'
	}

	if (packageName === 'react' || packageName === 'react-dom' || packageName === 'scheduler') {
		return 'react-vendor'
	}

	if (packageName.startsWith('@progress/')) {
		return `kendo-${sanitizeChunkName(packageName.replace('@progress/', ''))}`
	}

	if (packageName.startsWith('@vaadin/')) {
		return `vaadin-${sanitizeChunkName(packageName.replace('@vaadin/', ''))}`
	}

	if (packageName.startsWith('@storybook/') || packageName === 'storybook') {
		return 'storybook-vendor'
	}

	if (packageName.startsWith('@arcgis/') || packageName === 'leaflet') {
		return 'mapping-vendor'
	}

	if (id.includes('recharts') || id.includes('d3-')) {
		return 'charts'
	}

	if (markdownPackages.some((pkg) => id.includes(pkg))) {
		return 'markdown'
	}

	return 'vendor'
}

export default defineConfig({
	plugins: [react()],
	server: {
		// Do not proxy /v1 here; the app calls the middle tier on VITE_PROXY_BASE_URL.
		proxy: {
			// other dev proxies (if any) can remain
		},
	},
	build: {
		// FastTrack currently ships as a prebuilt monolithic module, so keep warnings
		// focused on new app chunks rather than the isolated third-party vendor bundle.
		chunkSizeWarningLimit: 1600,
		rollupOptions: {
			output: {
				manualChunks,
			},
		},
	},
});