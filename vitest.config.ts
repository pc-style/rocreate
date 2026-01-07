import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
        globals: true,
        setupFiles: ['./vitest.setup.ts'],
    },
});
