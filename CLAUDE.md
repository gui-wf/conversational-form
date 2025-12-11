# Conversational Form Library - Custom Fork

This is a customized fork of [space10-community/conversational-form](https://github.com/space10-community/conversational-form) v1.0.2 with additional features and enhancements.

**Version:** 2.0.0

**Changes:** See [CHANGELOG.md](CHANGELOG.md) for detailed list of features, breaking changes, and migration guide.

## Tech Stack
- **Language**: TypeScript (compiled to ES5)
- **Build System**: Gulp + TypeScript Compiler
- **Module System**: TypeScript namespaces (concatenated to single file, no ES6 modules)
- **Target**: ES5 for broad browser compatibility
- **Style**: Sass/SCSS

## Project Structure
```
conversational-form/
├── src/
│   ├── scripts/cf/          # TypeScript source files
│   │   ├── ConversationalForm.ts        # Main entry point & configuration
│   │   ├── form-tags/                   # Tag implementations (InputTag, SelectTag, etc.)
│   │   ├── ui/
│   │   │   ├── control-elements/        # UI components (OptionButton, etc.)
│   │   │   └── inputs/                  # Input handlers (UserTextInput)
│   │   └── logic/                       # Business logic
│   └── styles/              # SCSS stylesheets
├── build/                   # Intermediate build output
├── dist/                    # Final distribution files
│   ├── conversational-form.js
│   ├── conversational-form.min.js       # Minified JavaScript
│   └── conversational-form.min.css      # Minified CSS
├── scripts/
│   └── copy-dist.sh         # Script to copy built files to target directory
├── gulp-tasks/              # Gulp task definitions
└── gulpfile.js              # Gulp configuration

```

## Build Commands

```bash
# Install dependencies
npm install

# Build everything (fuzzy search + TypeScript + Sass)
npm run build:all

# Build only (no fuzzy search bundling)
npm run build

# Copy built files to target directory
TARGET=../nuxt-app/public/cf npm run copy-dist

# Build and copy in one command
TARGET=../nuxt-app/public/cf npm run build:copy
```

## Architecture Overview

### Configuration Flow
1. **ConversationalFormOptions** interface defines available options (ConversationalForm.ts:22-93)
2. Static properties on `ConversationalForm` class store global config (ConversationalForm.ts:104-109)
3. Constructor processes options and sets static properties (ConversationalForm.ts:163-173)
4. Components access config via static properties: `ConversationalForm.disableSelectPrefill`

### Tag System
- **Tag.ts** - Base class for all form elements
- **InputTag.ts** - Handles text/email/number/etc inputs
- **SelectTag.ts** - Handles select dropdowns, creates OptionTag children
- **OptionTag.ts** - Represents individual option elements
- **OptionButton.ts** - UI component that renders clickable option buttons

### Value Flow
1. User interaction triggers `UserTextInput.getInputValue()` (UserTextInput.ts:126)
2. Value is sanitized and returned
3. `FlowManager` processes value and moves to next question
4. `submitCallback` receives final form data via `cf.getFormData(true)`

### Build Process
The build follows a specific order due to TypeScript namespace dependencies:

1. **Bundle fuzzy search** (`npm run bundle-fuzzy`)
   - Browserify packages fast-fuzzy for standalone use

2. **Compile TypeScript** (gulp-tasks/scripts.js:22-46)
   - Compiles `.ts` files from `src/scripts/` to `build/`
   - Target: ES5, no modules

3. **Concatenate files** (gulp-tasks/scripts.js:63-122)
   - Specific order matters (base classes before derived classes)
   - Outputs to `build/conversational-form.js`

4. **Copy & minify**
   - Copy to `dist/` and create minified versions
   - JavaScript: uglify
   - CSS: cssnano

5. **Compile Sass** (parallel with scripts)
   - Compiles SCSS to CSS
   - Outputs to `dist/conversational-form.min.css`

## Development Guidelines

### Versioning

This fork follows [Semantic Versioning](https://semver.org/) (MAJOR.MINOR.PATCH):

**MAJOR version (X.0.0)** - Increment when making **breaking changes**:
- Changes that alter existing behavior (e.g., fuzzy matching algorithm change)
- Removing or renaming public APIs
- Changing default behavior of existing features
- Build system changes that affect consumers

**MINOR version (1.X.0)** - Increment when adding **new features** (backwards-compatible):
- New configuration options with default values that preserve existing behavior
- New public methods or properties
- New functionality that doesn't change existing behavior

**PATCH version (1.0.X)** - Increment for **bug fixes** (backwards-compatible):
- Fixing incorrect behavior
- Performance improvements
- Documentation updates (if bundled in a release)
- Internal refactoring without API changes

**When updating version:**
1. Update `package.json` version field
2. Update `src/scripts/cf/ConversationalForm.ts` version property
3. Document changes in `CHANGELOG.md` under appropriate section
4. Rebuild: `npm run build:all`
5. Commit with message format: `chore: bump version to X.Y.Z`

**Example scenarios:**
```
Adding disableSelectPrefill option (default: false) → MINOR (1.1.0)
Changing fuzzy match scoring algorithm → MAJOR (2.0.0)
Fixing memory leak in ChatList → PATCH (1.0.1)
Build system Gulp 3 → 4 upgrade → MAJOR (2.0.0)
```

### Adding New Configuration Options

**Pattern to follow:**
```typescript
// 1. Add to interface (ConversationalForm.ts ~line 90)
export interface ConversationalFormOptions {
  // ...
  yourNewOption?: boolean;
}

// 2. Add static property (ConversationalForm.ts ~line 109)
export class ConversationalForm {
  public static yourNewOption: boolean = false; // default value

  // 3. Process in constructor (ConversationalForm.ts ~line 173)
  constructor(options: ConversationalFormOptions) {
    if(typeof options.yourNewOption === 'boolean')
      ConversationalForm.yourNewOption = options.yourNewOption;
  }
}

// 4. Use in components
if (ConversationalForm.yourNewOption) {
  // Your custom behavior
}
```

### ES5 Compatibility Notes

The library targets ES5 for browser compatibility. Avoid using:
- `trimStart()` / `trimEnd()` - Use regex: `.replace(/^\s+/, '')` / `.replace(/\s+$/, '')`
- `startsWith()` / `endsWith()` - Use regex or `indexOf()`
- Template literals - Use string concatenation
- Arrow functions in class methods - Use `function` keyword
- `const` / `let` in concatenated code - Use `var` or namespace properties

### TypeScript Errors During Build

The build process shows TypeScript errors but completes with "emit succeeded (with errors)". These are pre-existing compatibility warnings:
- Missing ES6 Promise polyfill declarations
- HTMLCollection vs NodeList type mismatches
- Legacy API usage

These don't affect functionality and are part of the original codebase.

### Testing Changes

1. Make changes to TypeScript source
2. Build: `npm run build:all`
3. Copy to target project: `TARGET=../nuxt-app/public/cf npm run copy-dist`
4. Test in browser
5. Repeat as needed

**Quick iteration:**
```bash
TARGET=../nuxt-app/public/cf npm run build:copy
```

## Copy Script Details

**Script:** `scripts/copy-dist.sh`

**Features:**
- Validates TARGET environment variable is set
- Checks that dist files exist before copying
- Creates target directory if needed
- Provides clear error messages
- Cross-platform compatible (POSIX sh)

**Files copied:**
- `dist/conversational-form.min.js` → `$TARGET/conversational-form.min.js`
- `dist/conversational-form.min.css` → `$TARGET/conversational-form.min.css`

**Example usage:**
```bash
# Copy to default location (nuxt-app)
TARGET=../nuxt-app/public/cf npm run copy-dist

# Copy to custom location
TARGET=/path/to/project/assets npm run copy-dist

# Build and copy together
TARGET=../nuxt-app/public/cf npm run build:copy
```

## Important Notes

- **No ES6 Modules**: Library uses TypeScript namespaces and concatenation
- **Build Order Matters**: Files concatenated in dependency order (see gulp-tasks/scripts.js:65-111)
- **Global Namespace**: Everything under `window.cf` namespace
- **Static Configuration**: Options stored as static properties for global access
- **No emojis**: Per project preference
- **Forked Repository**: Track upstream changes manually if needed

## Related Documentation

- **Upstream docs**: https://space10-community.github.io/conversational-form/
- **Usage in Nuxt app**: `../nuxt-app/CLAUDE.md`
- **Original repository**: https://github.com/space10-community/conversational-form

## Documentation Standards

When writing code, include succinct and self-explanatory documentation that explains the "why" behind technical choices:
- Use brief comments that explain the purpose and reasoning
- Focus on why a particular approach was chosen, not just what the code does
- Keep comments clear and straightforward
- Example format: `// Why: [reason] | How: [approach]`
