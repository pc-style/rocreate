import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
        globals: true,
        setupFiles: ['./vitest.setup.ts'],
    },
    plugins: [
        {
            name: 'glsl-plugin',
            transform(code, id) {
                if (id.endsWith('.glsl')) {
                    return {
                        code: 'export default ""',
                        map: null,
                    };
                }
            },
        },
    ],
    resolve: {
        alias: [
            { find: /^url:(.*)/, replacement: '$1' },
        ],
    },
});
