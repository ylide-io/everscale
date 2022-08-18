/**
 * @returns {string}
 */
declare function generate_ephemeral(): string;
/**
 * @param {string} secret_key_hex
 * @returns {string}
 */
declare function get_public_key(secret_key_hex: string): string;
declare function encrypt(secret_key_hex: string, recipient_public_hex: string, raw_data: string, raw_nonce: string): string;
declare function initAsync(): Promise<any>;
declare function init(input?: any): Promise<any>;
export default init;
export { initAsync, encrypt, generate_ephemeral, get_public_key };
