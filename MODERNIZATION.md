# Modernization Roadmap

**Last Updated:** 2024-12-04
**Current Stack:** Gulp 4.0.2, Karma 6.4.4, Jasmine 4.6.0, TypeScript (ES5), Sass, Bower

This document provides actionable modernization paths for the Conversational Form build system and test infrastructure. Choose the appropriate option based on project needs and risk tolerance.

---

## Current State

### Build System
- **Gulp 4.0.2** - Task runner for TypeScript compilation, Sass processing, file concatenation
- **TypeScript** - Targeting ES5 for broad browser compatibility
- **Sass** - CSS preprocessing with gulp-sass + dart-sass
- **Bower** - Legacy dependency management for polyfills (promise-polyfill, custom-event-polyfill)

### Test Infrastructure
- **Karma 6.4.4** - Test runner (**DEPRECATED April 2023**)
- **Jasmine 4.6.0** - Testing framework
- **Firefox + Chrome** - Test browsers

### Known Issues
- Karma is deprecated and will not receive updates or security fixes
- Bower is deprecated since 2017
- Some Sass deprecation warnings (division with `/` operator)
- Targeting ES5 limits modern JavaScript features

---

## Option 1: Incremental Modernization

Minimize risk by updating individual components while preserving overall architecture.

### Phase 1: Replace Karma (CRITICAL - Do First)

**Why:** Karma is deprecated and will not receive security fixes.

**Recommended:** jasmine-browser-runner

**Installation:**
```bash
npm install --save-dev jasmine-browser-runner
```

**Configuration:**
Create `spec/support/jasmine-browser.json`:
```json
{
  "srcDir": "dist",
  "srcFiles": [
    "conversational-form.js"
  ],
  "specDir": "tests",
  "specFiles": [
    "**/*.js"
  ],
  "browser": {
    "name": "firefox"
  }
}
```

**Update package.json scripts:**
```json
{
  "scripts": {
    "test": "jasmine-browser-runner runSpecs",
    "test:chrome": "JASMINE_BROWSER=chrome jasmine-browser-runner runSpecs"
  }
}
```

**Remove from package.json:**
- karma
- karma-jasmine
- karma-firefox-launcher
- karma-chrome-launcher
- jasmine-core (jasmine-browser-runner includes it)

**Remove files:**
- `karma.conf.js`
- gulpfile.js karma task

**Validation:**
```bash
npm test
# Tests should run in Firefox and pass
```

**Alternative:** Web Test Runner (more features, slightly more complex setup)

---

### Phase 2: Remove Bower

**Why:** Bower is deprecated and poses security risks.

**Current Bower Dependencies:**
- `promise-polyfill@^6.0.2`
- `custom-event-polyfill@^0.3.0`

**Option A: Remove Polyfills (Modern Browsers Only)**

If targeting modern browsers (Chrome 60+, Firefox 60+, Safari 12+), native APIs are sufficient:
- Native `Promise` (ES6) is widely supported
- Native `CustomEvent` is widely supported

**Steps:**
1. Remove bower task from gulpfile.js
2. Remove bower.json
3. Update scripts.js to remove bower_components paths
4. Test in target browsers

**Option B: Use npm Polyfills**

For broader compatibility:
```bash
npm install --save promise-polyfill custom-event-polyfill
```

Update `gulp-tasks/scripts.js`:
```javascript
// Replace bower paths
const src = [
  'node_modules/promise-polyfill/dist/polyfill.js',
  'node_modules/custom-event-polyfill/polyfill.js',
  // ... rest of files
];
```

**Option C: Use Polyfill.io CDN**

Add to HTML:
```html
<script crossorigin="anonymous"
  src="https://polyfill.io/v3/polyfill.min.js?features=Promise%2CCustomEvent">
</script>
```

Remove polyfills from build entirely.

**Validation:**
```bash
gulp build
# Check dist/conversational-form.js exists and works
# Test in IE11 if supporting legacy browsers
```

---

### Phase 3: Fix Sass Deprecations (Optional)

**Current Issue:** Sass warns about division operator `/` being deprecated.

**Solution:** Replace `/` with `math.div()` or `calc()`

**Steps:**

1. Install sass dependency explicitly:
```bash
cd gulp-tasks
npm install --save-dev sass
```

2. Update affected files in `src/styles/`:
```scss
// Before
width: $cf-input-field-height / 2;

// After (Option 1 - math.div)
@use "sass:math";
width: math.div($cf-input-field-height, 2);

// After (Option 2 - calc)
width: calc($cf-input-field-height / 2);
```

**Validation:**
```bash
gulp sass-form
# Should compile without deprecation warnings
```

---

### Phase 4: Modernize TypeScript Target (Optional)

**Current:** ES5 for maximum compatibility
**Recommended:** ES2015 (90%+ browser support, smaller bundles, better performance)

**Update tsconfig.json (if exists) or gulp-tasks/scripts.js:**
```javascript
.pipe(typescript({
  noImplicitAny: true,
  target: "ES2015",  // was "ES5"
  module: "none"
}))
```

**Benefits:**
- Smaller output (native classes, arrow functions)
- Better performance
- Access to modern syntax

**Validation:**
```bash
gulp build
# Test in target browsers (Chrome 51+, Firefox 52+, Safari 10+, Edge 14+)
```

---

## Option 2: Replace Build System with Vite

Modern bundler for significantly better developer experience and build performance.

### Installation

```bash
npm install --save-dev vite @vitejs/plugin-legacy vite-plugin-sass
```

### Configuration

Create `vite.config.js`:
```javascript
import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/scripts/cf/ConversationalForm.ts'),
      name: 'ConversationalForm',
      formats: ['umd', 'es'],
      fileName: (format) => `conversational-form.${format === 'es' ? 'mjs' : 'js'}`
    },
    outDir: 'dist',
    rollupOptions: {
      output: {
        assetFileNames: 'conversational-form.[ext]'
      }
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `$injectedColor: orange;`
      }
    }
  },
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11']
    })
  ]
});
```

### Update package.json

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

### Migration Checklist

- [ ] Move main entry point to `src/main.ts`
- [ ] Convert gulp tasks to Vite plugins or npm scripts
- [ ] Update import paths to use ES modules
- [ ] Remove gulp dependencies
- [ ] Test dev server: `npm run dev`
- [ ] Test production build: `npm run build`
- [ ] Verify dist outputs match expected format
- [ ] Update CI/CD pipelines

### Testing with Vite

Install Vitest for Vite-native testing:
```bash
npm install --save-dev vitest @vitest/ui
```

Update `vite.config.js`:
```javascript
export default defineConfig({
  // ... existing config
  test: {
    globals: true,
    environment: 'jsdom'
  }
});
```

Convert Jasmine tests to Vitest (mostly compatible):
```javascript
// Jasmine
describe('Test', () => {
  it('works', () => {
    expect(true).toBe(true);
  });
});

// Vitest (same API)
describe('Test', () => {
  it('works', () => {
    expect(true).toBe(true);
  });
});
```

### Benefits
- 10-100x faster builds
- Hot Module Replacement (HMR)
- Native TypeScript support
- Modern defaults (tree-shaking, ES modules)
- Built-in dev server

### Trade-offs
- Requires restructuring source files
- Different plugin ecosystem
- Learning curve if unfamiliar with Vite

---

## Option 3: Full Modernization

Complete rewrite of build and test infrastructure targeting modern browsers only.

### Recommended Stack
- **Bundler:** Vite 5+
- **Testing:** Vitest (Vite-native, Jest-compatible)
- **TypeScript:** ES2020+ target
- **CSS:** Lightning CSS or modern CSS with nesting
- **Package Manager:** pnpm (faster than npm)
- **Polyfills:** None (modern browsers only)

### Target Browser Support
- Chrome 90+
- Firefox 88+
- Safari 15+
- Edge 90+

### Migration Strategy

**Phase 1: Setup Modern Build**
1. Install Vite + Vitest
2. Create vite.config.js
3. Update tsconfig.json for ES2020
4. Configure build outputs

**Phase 2: Migrate Source Code**
1. Convert to ES modules (`import`/`export`)
2. Replace TypeScript namespace pattern with modules
3. Update async patterns to async/await
4. Remove polyfills

**Phase 3: Migrate Tests**
1. Convert Jasmine → Vitest
2. Update test utilities
3. Configure browser testing if needed
4. Run full test suite

**Phase 4: Update Build Outputs**
1. Generate ESM + UMD bundles
2. Create modern + legacy builds
3. Update package.json exports
4. Verify npm package works

**Phase 5: Documentation & CI**
1. Update README with new build commands
2. Update CI/CD pipelines
3. Update contributor docs
4. Publish new version

### Validation Checklist
- [ ] All tests pass
- [ ] No console errors in target browsers
- [ ] Bundle size reduced or maintained
- [ ] Source maps work correctly
- [ ] npm package installs correctly
- [ ] CDN links work
- [ ] Documentation updated

---

## Decision Criteria

### Choose Option 1 (Incremental) If:
- Project is in maintenance mode
- Minimal risk tolerance
- Limited development time
- Current build works adequately

### Choose Option 2 (Vite) If:
- Active development planned
- Want modern DX improvements
- Comfortable with medium risk
- Can invest 20-30 hours

### Choose Option 3 (Full Rewrite) If:
- Planning major refactor anyway
- Targeting modern browsers only
- Team has bandwidth for large project
- Want cutting-edge tech stack

---

## Tool-Specific Commands

### Karma → jasmine-browser-runner
```bash
# Old
karma start

# New
jasmine-browser-runner runSpecs
```

### Gulp → Vite
```bash
# Old
gulp build
gulp watch

# New
vite build
vite dev
```

### npm → pnpm (if modernizing)
```bash
# Install pnpm
npm install -g pnpm

# Migrate
pnpm import  # converts package-lock.json
pnpm install
```

---

## Breaking Change Documentation

When executing modernizations, document breaking changes in commit messages:

```
feat: migrate from Karma to jasmine-browser-runner

BREAKING CHANGE: Test command changed from `karma start` to `npm test`.
Karma configuration has been replaced with jasmine-browser.json.

Tests now run with: npm test
For Chrome: JASMINE_BROWSER=chrome npm test
```

---

## Resources

### Official Documentation
- [jasmine-browser-runner](https://github.com/jasmine/jasmine-browser-runner)
- [Vite Documentation](https://vitejs.dev/)
- [Vitest Documentation](https://vitest.dev/)
- [Dart Sass Migration](https://sass-lang.com/documentation/breaking-changes/)

### Migration Guides
- [Karma Deprecation Notice](https://github.com/karma-runner/karma#karma-is-deprecated)
- [Gulp 3 → 4 Migration](https://gulpjs.com/docs/en/getting-started/quick-start/)
- [TypeScript Compiler Options](https://www.typescriptlang.org/tsconfig)

---

## Rollback Procedures

### If Tests Fail After Migration
1. Revert changes: `git revert HEAD`
2. Reinstall old dependencies: `npm install`
3. Run old test command
4. Review error logs
5. Fix issues incrementally

### If Build Fails
1. Check for missing dependencies: `npm install`
2. Verify paths in configuration files
3. Check for TypeScript errors: `tsc --noEmit`
4. Compare dist output with expected format

### Emergency Rollback
```bash
# Restore to last working state
git reset --hard origin/master
npm install
gulp build
```

---

**End of Modernization Guide**

Refer to this document when planning or executing technical upgrades. Update this file as new modernization opportunities are identified or completed.
