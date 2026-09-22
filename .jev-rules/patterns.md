RULE_ASYNC:
- BAN floating promises: every Promise must be awaited or .catch()'d
- MUST wrap async I/O in try/catch
- BAN async callbacks in forEach/reduce (use for-of)

RULE_NAMING:
- camelCase: variables, functions
- PascalCase: types, interfaces, classes
- UPPER_SNAKE_CASE: constants
- BAN single-letter identifiers (except loop i, j)

RULE_STRUCTURE:
- Named exports only (no default exports)
- BAN 'any'
- BAN type casting ('as', 'as unknown as')
