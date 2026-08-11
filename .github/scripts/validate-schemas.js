/*
 * SSAR Schema Validator
 *
 * Validates the JSON Schemas registered in `public/schemas/list.json`.
 * The registry defines which schemas are available for validation.
 *
 * The script:
 *  - Reads the schema registry.
 *  - Validates each registered JSON Schema.
 *  - Updates the `invalid` list when a schema fails validation.
 *  - Removes schemas from `invalid` when they become valid again.
 *
 * This script is executed by the GitHub Actions schema validation workflow.
 *
 * @project      SSAR Schema Registry
 * @module       validate-schemas-json
 * @author       SSAR Group Global
 * @copyright    Copyright (c) 2026 SSAR Group Global
 * @license      MIT
 *
 * SPDX-License-Identifier: MIT
 */

const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");

const ROOT = path.resolve("public/schemas");
const LIST_FILE = path.join(ROOT, "list.json");

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
}

function main() {
  if (!fs.existsSync(LIST_FILE)) {
    console.error(`Missing registry: ${LIST_FILE}`);
    process.exit(1);
  }

  const registry = readJson(LIST_FILE);

  if (!registry.valid && registry.error) {
    console.error(`Invalid list.json: ${registry.error}`);
    process.exit(1);
  }

  if (!Array.isArray(registry.available)) {
    console.error('"available" must be an array.');
    process.exit(1);
  }

  if (!Array.isArray(registry.invalid)) {
    registry.invalid = [];
  }

  const ajv = new Ajv({
    strict: false,
    allErrors: true,
  });

  const invalid = [];
  const valid = [];

  for (const schemaName of registry.available) {
    const schemaPath = path.join(ROOT, schemaName);

    console.log(`Checking ${schemaName}...`);

    if (!fs.existsSync(schemaPath)) {
      console.error(`File not found`);
      invalid.push(schemaName);
      continue;
    }

    const result = readJson(schemaPath);

    if (!result.valid && result.error) {
      console.error(`Invalid JSON`);
      console.error(`${result.error}`);
      invalid.push(schemaName);
      continue;
    }

    try {
      ajv.compile(result);

      console.log(`Valid JSON Schema`);
      valid.push(schemaName);
    } catch (error) {
      console.error(`Invalid JSON Schema`);
      console.error(`${error.message}`);
      invalid.push(schemaName);
    }
  }

  registry.invalid = [...new Set(invalid)];

  // Remove schemas from invalid when they become valid again.
  registry.invalid = registry.invalid.filter((name) => !valid.includes(name));

  // Keep invalid schemas out of the available list.
  registry.available = registry.available.filter(
    (name) => !registry.invalid.includes(name),
  );

  fs.writeFileSync(LIST_FILE, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

  console.log("");
  console.log("Schema registry updated.");
  console.log(`Valid:   ${valid.length}`);
  console.log(`Invalid: ${registry.invalid.length}`);

  if (registry.invalid.length > 0) {
    console.error("");
    console.error("Invalid schemas:");

    for (const name of registry.invalid) {
      console.error(`  - ${name}`);
    }

    process.exit(1);
  }
}

main();
