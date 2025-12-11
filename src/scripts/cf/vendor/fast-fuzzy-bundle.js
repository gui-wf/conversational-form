// Fast-fuzzy bundle wrapper for conversational-form
// This makes fast-fuzzy available as a global variable for the concatenated build
(function() {
    // Include graphemesplit dependency
    var graphemesplit = (function() {
        // Simplified version - using native split for compatibility
        // In production, you might want to include the full graphemesplit library
        return function(str) {
            return Array.from(str);
        };
    })();

    // Now we'll manually include a simplified version of fast-fuzzy
    // For a production build, you'd want to include the full library

    // This is a placeholder - we need to properly bundle fast-fuzzy
    // Let's use a different approach: copy the actual fast-fuzzy code
    window.fastFuzzy = {
        fuzzy: function(term, candidate, options) {
            // For now, return a simple placeholder
            // This will be replaced with the actual bundled code
            options = options || {};
            var threshold = options.threshold || 0.6;

            if (!term || !candidate) return 0;

            var termLower = term.toLowerCase();
            var candidateLower = candidate.toLowerCase();

            // Simple substring match
            if (candidateLower.indexOf(termLower) !== -1) {
                return 1.0;
            }

            // Simple similarity score
            var matches = 0;
            for (var i = 0; i < termLower.length; i++) {
                if (candidateLower.indexOf(termLower[i]) !== -1) {
                    matches++;
                }
            }

            return matches / termLower.length;
        }
    };
})();
