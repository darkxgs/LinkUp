import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider, theme } from 'antd'
import './index.css'
import './embed-mobile.css'
import { initEmbedViewport } from './embedViewport.js'
import { readLangFromUrl } from './i18n/casinoI18n.js'
import App from './App.jsx'

readLangFromUrl()

if (typeof window !== 'undefined' && (window.ReactNativeWebView || window.location.search.includes('embed=1'))) {
  document.documentElement.classList.add('linkup-embed', 'linkup-embed-casino');
  initEmbedViewport();
}

// Custom dark theme for Linkup
const linkupTheme = {
    algorithm: theme.darkAlgorithm,
    token: {
        colorPrimary: '#00f0ff',
        colorBgBase: '#12141d',
        colorBgContainer: '#0a0b10',
        colorBgElevated: '#1c1f2e',
        colorBorder: '#1c1f2e',
        colorText: '#ffffff',
        colorTextSecondary: '#b1bad3',
        colorSuccess: '#00f0ff',
        colorWarning: '#f7931a',
        colorError: '#ed4245',
        colorInfo: '#ff2e93',
        borderRadius: 8,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
    components: {
        Button: {
            primaryColor: '#000000',
            colorPrimaryHover: '#00d0dd',
        },
        Input: {
            colorBgContainer: '#12141d',
            colorBorder: '#1c1f2e',
            activeBorderColor: '#ff2e93',
        },
        InputNumber: {
            colorBgContainer: '#12141d',
            colorBorder: '#1c1f2e',
        },
        Tabs: {
            colorBgContainer: '#12141d',
            itemSelectedColor: '#ffffff',
            itemColor: '#b1bad3',
        },
        Card: {
            colorBgContainer: '#0a0b10',
            colorBorderSecondary: '#1c1f2e',
        },
        Slider: {
            colorPrimaryBorderHover: '#00f0ff',
            handleColor: '#00f0ff',
            trackBg: '#00f0ff',
            trackHoverBg: '#00d0dd',
        },
        Tooltip: {
            colorBgSpotlight: '#1c1f2e',
        },
    },
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider theme={linkupTheme}>
      <App />
    </ConfigProvider>
  </StrictMode>,
)

