# Changelog

All notable changes to this fork of conversational-form will be documented in this file.

This fork is based on [space10-community/conversational-form](https://github.com/space10-community/conversational-form) version **1.0.2**.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2025-12-11

### Added

#### Disable Select Prefill Configuration Option
- **Option**: `disableSelectPrefill: boolean` (default: `false`)
- **Problem**: HTML select elements automatically select the first option by default, causing confusion for required questions where users expect to make an explicit choice
- **Solution**: New boolean configuration option to disable automatic prefilling

**Files Modified:**
- `src/scripts/cf/ConversationalForm.ts:92` - Added to options interface
- `src/scripts/cf/ConversationalForm.ts:109` - Added static property
- `src/scripts/cf/ConversationalForm.ts:172-173` - Process option in constructor
- `src/scripts/cf/ui/control-elements/OptionButton.ts:51` - Check config before applying selected state

**Usage:**
```javascript
ConversationalForm.startTheConversation({
  options: {
    disableSelectPrefill: true
  },
  tags: formTags
})
```

---

#### Leading Space Prevention
- **Problem**: Users could submit inputs consisting only of spaces, bypassing required field validation
- **Solution**: Automatically strip leading spaces from all text input values

**Files Modified:**
- `src/scripts/cf/ui/inputs/UserTextInput.ts:129` - Modified `getInputValue()` to use `.replace(/^\s+/, '')`

**Technical Note:** Uses regex instead of `trimStart()` for ES5 compatibility.

---

#### Build and Copy Script
**Added:**
- `scripts/copy-dist.sh` - Shell script to copy built assets to target directory
- `package.json` - New npm scripts: `copy-dist` and `build:copy`

**Usage:**
```bash
TARGET=../nuxt-app/public/cf npm run build:copy
```

### Breaking Changes

#### Build System Modernization (2025-12-04)
**Commit:** `887370c` - "chore: upgrade build system and fix deprecation warnings"

**Upgraded Dependencies:**
- Karma: 3.1.4 → 6.4.4 (deprecated → current)
- Gulp: 3.9.1 → 4.0.2 (v3 → v4 - **BREAKING**: different API)
- Jasmine: 3.3.0 → 4.6.0
- gulp-uglify → gulp-terser (ES6+ support)
- gulp-sass updated to use dart-sass
- Replaced PhantomJS with Firefox/Chrome launchers

**Build System Changes (Breaking):**
- Updated Gulp task syntax to v4 API (gulp.series, async completion)
- Fixed Karma API to use parseConfig() instead of deprecated constructor
- Fixed Sass division operator deprecations (use math.div())
- Removed gulp-sync dependency (use native gulp.series)

**Impact:** If you were using the build system directly, you need to:
- Update Gulp 3 → Gulp 4 syntax if you have custom tasks
- Karma configuration uses new API
- All 32 tests passing in Firefox and Chrome

**Added:**
- Nix flake for development environment (`.envrc`, `flake.nix`, `flake.lock`)
- Updated `.gitignore`

---

#### Fuzzy String Matching with Weighted Scoring (2025-12-11)
**Commit:** `91c8dc2` - "Add fuzzy string matching with weighted scoring"

**Changes Behavior (Potentially Breaking):**
- Integrated fast-fuzzy library for improved option matching
- **Changed selection logic**: Now uses weighted scoring instead of first match
- Scoring: exact match (1.0) > prefix match (0.95) > suffix match (0.90) > fuzzy match

**Example Impact:**
- User types "30"
- **Before**: Might select "21-30" (first fuzzy match)
- **After**: Correctly selects "30+" (exact prefix match)

**Files Modified:**
- `src/scripts/cf/form-tags/SelectTag.ts` - Select best match instead of first match
- `src/scripts/cf/ui/control-elements/ControlElements.ts` - Sort filtered options by score
- Added fast-fuzzy library via browserify UMD bundle

**Upgraded:**
- TypeScript: 3.0.3 → 4.9.5 (for ES2015 lib support)
- Created `tsconfig.json` with ES2015 lib support

**Added:**
- `src/scripts/cf/vendor/fast-fuzzy-bundle.js`
- `src/scripts/cf/vendor/fast-fuzzy-entry.js`
- `package.json` scripts: `bundle-fuzzy`, `build:all`

---

## Migration Guide

### From Upstream 1.0.2

#### Non-Breaking Changes (Safe to Upgrade)
- **Leading space prevention**: Automatic, no configuration needed
- **`disableSelectPrefill` option**: Opt-in, default behavior unchanged

**To enable new features:**
```javascript
ConversationalForm.startTheConversation({
  options: {
    disableSelectPrefill: true,  // Opt-in
    // ... other existing options
  },
  tags: yourTags
})
```

#### Potentially Breaking Changes

**1. Fuzzy Matching Behavior Change**
- **What changed**: Option selection now uses weighted scoring
- **Impact**: Users typing partial inputs may get different matches
- **Migration**: Test your forms to ensure option matching still works as expected
- **Benefit**: Better UX - "30" now correctly selects "30+" instead of "21-30"

**2. Build System (If Using Build Tools)**
- **What changed**: Gulp 3 → Gulp 4, updated dependencies
- **Impact**: Only affects you if you're building from source
- **Migration**:
  - Update to Gulp 4 if you have custom tasks
  - Use `npm run build:all` instead of custom gulp commands
  - All tests passing, no runtime changes

**3. TypeScript Version**
- **What changed**: TypeScript 3.0.3 → 4.9.5
- **Impact**: Only affects if you're extending/modifying the library in TypeScript
- **Migration**: Update your TypeScript version if building from source

---

## Version History

### Fork Information
- **Based on**: space10-community/conversational-form v1.0.2
- **Fork Repository**: https://github.com/gui-wf/conversational-form
- **Fork Purpose**: Modernization and custom features for personal projects

### Upstream Version 1.0.2
- **Last upstream commit integrated**: `a29373b` (Bumped version to 1.0.2)
- **Upstream repository**: https://github.com/space10-community/conversational-form

---

## Future Plans

See [MODERNIZATION.md](MODERNIZATION.md) for planned technical upgrades:
- Replace Karma (deprecated since April 2023)
- Remove Bower (deprecated since 2017)
- Address Sass deprecation warnings
- Consider ES2015+ output target
