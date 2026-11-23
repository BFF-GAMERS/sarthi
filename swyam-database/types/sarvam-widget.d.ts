/**
 * Sarvam's call widget is a custom element defined by a script from their CDN,
 * so JSX has no idea it exists. This declares it — attributes only, all
 * strings, exactly as the embed snippet writes them.
 *
 * React 19 moved the JSX namespace under the `react` module, so this augments
 * that rather than the old global one.
 */
import "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "sarvam-widget": {
        "api-key": string;
        "app-id": string;
        "org-id": string;
        "workspace-id": string;
        "user-id"?: string;
        "button-text"?: string;
        "interaction-type"?: "call" | "chat";
        "logo-url"?: string;
        language?: string;
      };
    }
  }
}
