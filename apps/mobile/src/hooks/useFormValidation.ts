import { useState, useCallback } from 'react';
import { ZodSchema } from 'zod';

export function useFormValidation<T>(schema: ZodSchema<T>) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = useCallback(
    (data: unknown): { success: true; data: T } | { success: false } => {
      setErrors({});
      const result = schema.safeParse(data);
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.errors.forEach((err) => {
          const key = err.path.join('.');
          fieldErrors[key] = err.message;
        });
        setErrors(fieldErrors);
        return { success: false };
      }
      return { success: true, data: result.data };
    },
    [schema]
  );

  const clearErrors = useCallback(() => setErrors({}), []);

  return { errors, validate, clearErrors };
}
