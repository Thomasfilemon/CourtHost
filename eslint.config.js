import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// ESLint catches common coding mistakes. Generated files are checked by tsc,
// but excluded from lint so we don't hand-edit Supabase-generated output.
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'courthost-backend/**', 'src/lib/supabase/database.types.ts', '**/*.backup.json'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
);
