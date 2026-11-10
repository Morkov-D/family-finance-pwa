import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {VitePWA} from 'vite-plugin-pwa';
export default defineConfig({base:'/family-finance-pwa/',plugins:[react(),VitePWA({registerType:'autoUpdate',includeAssets:['favicon.svg'],manifest:{name:'Мои Финансы — Семья',short_name:'Мои Финансы',description:'Учёт семейного бюджета',theme_color:'#132e3c',background_color:'#f4f7f8',display:'standalone',start_url:'.',scope:'.',icons:[{src:'favicon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]}})]});