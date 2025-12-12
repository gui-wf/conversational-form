# Changelog

All notable changes to this fork of conversational-form will be documented in this file.

This fork is based on [space10-community/conversational-form](https://github.com/space10-community/conversational-form) version **1.0.2**.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added - 2025-12-12

#### Numeric Range Matching for Select Options
- **Problem**: Typing "2" would incorrectly match "11-20" instead of "0-2" due to fuzzy matching finding "2" as a substring in "20"
- **Solution**: Intelligent numeric range detection that checks if input falls within range boundaries

**Features:**
- **Closed ranges**: "2" correctly matches "0-2" (input 2 is in range [0,2])
- **Open-ended ranges**: "31" matches "30+" (input 31 >= 30)
- **Decimal support**: "5.5" matches "5-10" or "5.5+"
- **Priority scoring**: Range matches score 1.1, higher than exact match (1.0) to beat fuzzy substring matches

**Implementation:**
- Added range detection in `getWeightedScore()` method
- Regex patterns: `/^(\d+\.?\d*)\s*[-–—]\s*(\d+\.?\d*)$/` for closed ranges (e.g., "0-2", "11-20")
- Regex pattern: `/^(\d+\.?\d*)\s*\+$/` for open-ended ranges (e.g., "30+", "10+")
- Supports various dash types (-, –, —) for internationalization

**Files Modified:**
- `src/scripts/cf/form-tags/SelectTag.ts:22-46` - Added range matching to scoring logic
- `src/scripts/cf/ui/control-elements/ControlElements.ts:318-342` - Added range matching to filtering logic

**Usage Example:**
```javascript
// Form with numeric range options
const formFields = [{
  tag: 'select',
  name: 'experience',
  'cf-questions': 'How many years of experience?',
  children: [
    { tag: 'option', value: '0-2', 'cf-label': '0-2' },
    { tag: 'option', value: '3-10', 'cf-label': '3-10' },
    { tag: 'option', value: '11-20', 'cf-label': '11-20' },
    { tag: 'option', value: '30+', 'cf-label': '30+' }
  ]
}];

// User types "2" → selects "0-2" ✓
// User types "31" → selects "30+" ✓
// User types "100" → selects "30+" ✓
```

---

### Changed - 2025-12-12

#### ⚠️ BREAKING: Renamed `disableSelectPrefill` to `prefillDefaultAnswer`
- **Old**: `disableSelectPrefill: boolean` (default: `false`)
- **New**: `prefillDefaultAnswer: boolean` (default: `true`)
- **Reason**: Inverted logic for better clarity - now expresses what SHOULD happen (prefill) rather than what should NOT happen (disable)

**Migration:**
```javascript
// OLD (v2.0.0)
disableSelectPrefill: false  // Enable prefilling (default)
disableSelectPrefill: true   // Disable prefilling

// NEW (v2.1.0+)
prefillDefaultAnswer: true   // Enable prefilling (default)
prefillDefaultAnswer: false  // Disable prefilling
```

**Files Modified:**
- `src/scripts/cf/ConversationalForm.ts:92` - Renamed option in interface
- `src/scripts/cf/ConversationalForm.ts:109` - Renamed static property, changed default to `true`
- `src/scripts/cf/ConversationalForm.ts:172-173` - Process renamed option
- `src/scripts/cf/ui/control-elements/OptionButton.ts:51` - Inverted logic to check `prefillDefaultAnswer === true`
- `src/scripts/cf/ui/inputs/UserTextInput.ts:420-421` - Inverted logic for input prefilling

**Impact:** If you were using `disableSelectPrefill`, update to `prefillDefaultAnswer` with inverted value.

---

## [2.0.0] - 2025-12-11

### Added

#### Select Prefill Configuration Option (Now Renamed - See Above)
- **Option**: `prefillDefaultAnswer: boolean` (default: `true`)
- **Problem**: HTML select elements automatically select the first option by default, causing confusion for required questions where users expect to make an explicit choice
- **Solution**: Boolean configuration option to control automatic prefilling

**Usage:**
```javascript
ConversationalForm.startTheConversation({
  options: {
    prefillDefaultAnswer: false  // Disable prefilling for cleaner UX
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
