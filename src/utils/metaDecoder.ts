/**
 * Decodes a string that has been double-encoded or escaped by Meta's export system.
 * Meta JSON exports often escape UTF-8 bytes as Latin-1 characters.
 */
export function decodeMetaString(str: string): string {
  if (!str) return '';
  try {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    return str;
  }
}

/**
 * Recursively decodes all string values in an object or array.
 */
export function decodeMetaObj<T>(obj: T): T {
  if (typeof obj === 'string') {
    return decodeMetaString(obj) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(decodeMetaObj) as unknown as T;
  }
  if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      newObj[key] = decodeMetaObj((obj as any)[key]);
    }
    return newObj;
  }
  return obj;
}
