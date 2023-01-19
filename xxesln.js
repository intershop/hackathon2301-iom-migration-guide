module.exports = {
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:json-schema-validator/recommended'],
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    root: true,

    rules: {
      "json-schema-validator/no-invalid": [
        "error",
        {
            "schemas": [
                {
                    "fileMatch": ["migrate.yaml", "global-steps.yaml"],
                    "schema": "migration-schema.json"
                }
            ]
        }
      ]
    }
  };
  