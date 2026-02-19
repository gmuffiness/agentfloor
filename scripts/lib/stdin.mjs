/**
 * stdin utilities for interactive CLI prompts
 */
import * as readline from "readline";

/**
 * Ask a question and return the user's answer
 * @param {string} question - The prompt to display
 * @param {string} [defaultValue] - Default value if user presses Enter
 * @returns {Promise<string>}
 */
export function ask(question, defaultValue) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || "");
    });
  });
}

/**
 * Ask user to choose from a list of options
 * @param {string} question - The prompt to display
 * @param {string[]} options - List of options
 * @returns {Promise<{index: number, value: string}>}
 */
export function choose(question, options) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  return new Promise((resolve) => {
    process.stderr.write(`${question}\n`);
    options.forEach((opt, i) => {
      process.stderr.write(`  ${i + 1}. ${opt}\n`);
    });
    rl.question("Choice: ", (answer) => {
      rl.close();
      const idx = parseInt(answer, 10) - 1;
      if (idx >= 0 && idx < options.length) {
        resolve({ index: idx, value: options[idx] });
      } else {
        resolve({ index: 0, value: options[0] });
      }
    });
  });
}

/**
 * Ask a yes/no question
 * @param {string} question - The prompt to display
 * @param {boolean} [defaultYes=true] - Default answer
 * @returns {Promise<boolean>}
 */
export function confirm(question, defaultYes = true) {
  const suffix = defaultYes ? "[Y/n]" : "[y/N]";
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  return new Promise((resolve) => {
    rl.question(`${question} ${suffix}: `, (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      if (a === "") resolve(defaultYes);
      else resolve(a === "y" || a === "yes");
    });
  });
}
