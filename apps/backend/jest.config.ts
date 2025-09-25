import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverageFrom: ["src/**/*.{ts,js}"],
  coverageDirectory: "../coverage",
  moduleNameMapper: {
    "^@kube-suite/shared/(.*)$": "<rootDir>/../../packages/shared/src/$1"
  }
};

export default config;
