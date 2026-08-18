const declarations = new Bun.Glob("dist/types/**/*.d.ts");

for await (const path of declarations.scan({ cwd: import.meta.dir + "/..", onlyFiles: true })) {
  const file = Bun.file(import.meta.dir + "/../" + path);
  const source = await file.text();
  const rewritten = source.replace(
    /(["'])(\.\.?\/[^"']+)\.(?:ts|tsx|mts|cts)\1/g,
    (_match, quote: string, specifier: string) => `${quote}${specifier}.js${quote}`,
  );
  if (rewritten !== source) await Bun.write(file, rewritten);
}
