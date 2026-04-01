/**
 * @file extensions.ts
 * Extension metadata shared across A2A runtime objects.
 */

export interface A2AExtension {
  /**
   * Globally unique URI for the extension.
   */
  uri: string;
  /**
   * Optional semantic version string for the extension contract.
   */
  version?: string;
  /**
   * Whether the extension is required for successful request handling.
   */
  required?: boolean;
}
