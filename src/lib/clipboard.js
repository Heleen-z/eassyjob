export async function copyText(text, { clipboard, selectFallback }) {
  try {
    if (!clipboard?.writeText) throw new Error('Clipboard unavailable');
    await clipboard.writeText(text);
    return { copied: true };
  } catch {
    selectFallback();
    return { copied: false };
  }
}
