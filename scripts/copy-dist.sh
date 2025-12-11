#!/bin/sh

# Copy built conversational-form assets to a target directory
# Usage: TARGET=../nuxt-app/public/cf npm run copy-dist
# Or: TARGET=../nuxt-app/public/cf sh scripts/copy-dist.sh

if [ -z "$TARGET" ]; then
  echo "Error: TARGET environment variable not set"
  echo "Usage: TARGET=<path> npm run copy-dist"
  echo "Example: TARGET=../nuxt-app/public/cf npm run copy-dist"
  exit 1
fi

# Check if dist files exist
if [ ! -f "dist/conversational-form.min.js" ]; then
  echo "Error: dist/conversational-form.min.js not found. Run 'npm run build:all' first."
  exit 1
fi

if [ ! -f "dist/conversational-form.min.css" ]; then
  echo "Error: dist/conversational-form.min.css not found. Run 'npm run build:all' first."
  exit 1
fi

# Create target directory if it doesn't exist
mkdir -p "$TARGET"

# Copy files
echo "Copying conversational-form assets to: $TARGET"
cp dist/conversational-form.min.js "$TARGET/conversational-form.min.js"
cp dist/conversational-form.min.css "$TARGET/conversational-form.min.css"

echo "✓ Successfully copied:"
echo "  - conversational-form.min.js"
echo "  - conversational-form.min.css"
echo "  to $TARGET"
