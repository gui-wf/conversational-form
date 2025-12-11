// Entry point for browserifying fast-fuzzy
// This creates a standalone bundle that exposes fast-fuzzy as a global variable

const { fuzzy, search, Searcher } = require('fast-fuzzy');

// Export for browserify UMD wrapper
module.exports = {
    fuzzy: fuzzy,
    search: search,
    Searcher: Searcher
};
