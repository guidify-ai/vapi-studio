import type { FormFieldSpec } from '@guidify-ai/vapi-studio';

/** Identity intake form — name, email, address (phone collected by voice for SMS). */
export const IDENTITY_FORM_ID = 1;

export const IDENTITY_FORM_FIELDS: FormFieldSpec[] = [
  { name: 'firstName', label: 'First name', type: 'string', required: true },
  { name: 'lastName', label: 'Last name', type: 'string', required: true },
  { name: 'email', label: 'Email', type: 'email', required: true },
  {
    name: 'address',
    label: 'Property address',
    type: 'textarea',
    required: true,
    placeholder: 'Number, street, city, province/state',
  },
];

export const FORM_TEMPLATES: Record<
  number,
  { title: string; fields: FormFieldSpec[] }
> = {
  [IDENTITY_FORM_ID]: {
    title: 'Your details',
    fields: IDENTITY_FORM_FIELDS,
  },
};
