/** `import text from "./file.md?raw"`: the file's contents as a string (webpack rule in next.config.ts; Vite supports it natively). */
declare module "*?raw" {
  const content: string;
  export default content;
}
