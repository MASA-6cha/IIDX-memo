import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath,URL} from 'node:url';

export default defineConfig({
 base:'/IIDX-memo/',
 plugins:[react()],
 resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}},
 define:{'process.env.NODE_ENV':JSON.stringify('production')},
 build:{outDir:'pages-dist',emptyOutDir:true},
});
