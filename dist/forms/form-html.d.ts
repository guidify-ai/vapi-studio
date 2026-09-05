/**
 * First-party HTML form renderer — builds a simple page from FormFieldSpec JSON.
 * Apps serve this from GET /forms/:exposeId; submit posts back to FormsService.
 */
import type { FormExposeHandle } from './form.types';
export interface RenderFormHtmlOptions {
    /** Absolute or relative form POST action (default: same expose path). */
    action?: string;
    title?: string;
    subtitle?: string;
    submitLabel?: string;
    /** Optional error banner (e.g. missing required field). */
    error?: string;
}
/**
 * Render a complete HTML document for a pending form expose.
 * Field definitions come from the expose handle (JSON → HTML).
 */
export declare function renderFormHtml(handle: Pick<FormExposeHandle, 'exposeId' | 'formId' | 'fields'>, options?: RenderFormHtmlOptions): string;
/** Thank-you page after successful submit. */
export declare function renderFormThanksHtml(options?: {
    title?: string;
    body?: string;
    /** Optional absolute or relative href shown under the body. */
    backHref?: string;
    backLabel?: string;
}): string;
/** Simple not-found / expired page. */
export declare function renderFormGoneHtml(message?: string): string;
//# sourceMappingURL=form-html.d.ts.map