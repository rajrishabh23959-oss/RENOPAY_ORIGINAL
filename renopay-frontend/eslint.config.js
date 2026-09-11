import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";

export default [
    js.configs.recommended,
    {
        files: ["src/**/*.{js,jsx}"],
        plugins: {
            "react-hooks": reactHooks,
            "react": react,
        },
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            parserOptions: {
                ecmaFeatures: { jsx: true }
            },
            globals: {
                console: "readonly",
                window: "readonly",
                document: "readonly",
                navigator: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
                setInterval: "readonly",
                clearInterval: "readonly",
                alert: "readonly",
                process: "readonly",
                fetch: "readonly",
                require: "readonly",
                module: "readonly",
                __dirname: "readonly"
            }
        },
        settings: {
            react: {
                version: "detect"
            }
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            ...react.configs.recommended.rules,
            "react/react-in-jsx-scope": "off",
            "react/prop-types": "off",
            "react/no-unescaped-entities": "off",
            "react-hooks/exhaustive-deps": "off",
            "react-hooks/purity": "off",
            "react-hooks/set-state-in-effect": "off",
            "react-hooks/immutability": "off",
            "react-hooks/refs": "off",
            "no-unused-vars": "warn",
            "no-undef": "off",
            "no-misleading-character-class": "off"
        }
    }
];
