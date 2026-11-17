import { defineConfig } from 'vite';

const HM_IDS = {
    test: '8e4ba34c3cc7fd103d1618b1fba1d0c1',
    prod: '5217b12cddad16ab53057520af48146c'
};

const packTarget = process.env.PACK_TARGET;
const hmId = HM_IDS[packTarget];

if (!hmId) {
    throw new Error('PACK_TARGET must be test or prod. Double-click 打包.cmd and choose an environment.');
}

const BAIDU_HM = `var _hmt = _hmt || [];
(function() {
  var hm = document.createElement("script");
  hm.src = "https://hm.baidu.com/hm.js?${hmId}";
  var s = document.getElementsByTagName("script")[0];
  s.parentNode.insertBefore(hm, s);
})();`;

const baiduAnalytics = () => {
    return {
        name: 'baidu-analytics',
        transformIndexHtml() {
            return {
                tags: [
                    {
                        tag: 'script',
                        injectTo: 'head',
                        children: BAIDU_HM
                    }
                ]
            };
        }
    };
};

const phasermsg = () => {
    return {
        name: 'phasermsg',
        buildStart() {
            process.stdout.write(`Building for ${packTarget}...\n`);
        },
        buildEnd() {
            process.stdout.write("Build finished.\n");
        }
    }
}   

export default defineConfig({
    base: './',
    logLevel: 'warning',
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        },
        minify: 'terser',
        terserOptions: {
            compress: {
                passes: 2
            },
            mangle: true,
            format: {
                comments: false
            }
        }
    },
    server: {
        port: 8080
    },
    plugins: [
        baiduAnalytics(),
        phasermsg()
    ]
});
