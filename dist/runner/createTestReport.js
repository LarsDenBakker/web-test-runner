const createError = (e, serverAddress) => `  ---
${e.stack.replace(new RegExp(serverAddress, 'g'), '.')}
  ...`;
export function createTestReport(file, serverAddress) {
    let summary = '';
    for (const result of file.results) {
        if (result.error) {
            summary += `not ok ${result.name}\n${createError(result.error, serverAddress)}\n`;
        }
        else {
            summary += `ok ${result.name}\n`;
        }
    }
    return `# ${file.path}\n${summary}\n1..${file.results.length}\n`;
}
