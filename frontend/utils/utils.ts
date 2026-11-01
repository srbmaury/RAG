export const prettyBytes = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export function fileExtension(filename: string): string {
    const name = filename.trim();
    const separator = name.lastIndexOf('.');
    return separator > 0 && separator < name.length - 1 ? name.slice(separator + 1).toLowerCase() : '';
}

export const prompts = ['What are the key takeaways?', 'What risks should I be aware of?', 'Compare the main findings across documents', 'Which decisions still need to be made?'];
