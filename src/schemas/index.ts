import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Senha deve ter no minimo 8 caracteres')
  .regex(/[A-Z]/, 'Senha deve ter pelo menos uma letra maiuscula')
  .regex(/[a-z]/, 'Senha deve ter pelo menos uma letra minuscula')
  .regex(/[0-9]/, 'Senha deve ter pelo menos um numero');

export const loginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: passwordSchema,
});

export const operatorSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no minimo 2 caracteres'),
  email: z.string().email('Email invalido'),
  password: passwordSchema,
  phone: z.string().optional().or(z.literal('')),
});

export const checklistSchema = z.object({
  operatorId: z.string().uuid('Selecione um operador'),
  machineName: z.string().min(2, 'Nome da maquina deve ter no minimo 2 caracteres'),
  date: z.string(),
  notes: z.string().optional(),
  items: z.array(z.object({
    description: z.string().min(1, 'Descricao obrigatoria'),
    checked: z.boolean(),
    photoUri: z.string().optional(),
  })).min(1, 'Adicione pelo menos um item'),
});

export const safetyAlertSchema = z.object({
  title: z.string().min(3, 'Titulo deve ter no minimo 3 caracteres'),
  message: z.string().min(10, 'Mensagem deve ter no minimo 10 caracteres'),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  operatorId: z.string().uuid('Selecione um operador').optional().or(z.literal('')),
});

export const alertResponseSchema = z.object({
  response: z.string().min(3, 'Resposta deve ter no minimo 3 caracteres'),
});

export const preOperationSchema = z.object({
  answers: z.record(z.string().uuid(), z.boolean({ required_error: 'Responda esta pergunta' })),
});

export const activitySchema = z.object({
  location: z.string().min(2, 'Local deve ter no minimo 2 caracteres'),
  description: z.string().min(3, 'Descricao deve ter no minimo 3 caracteres'),
});

export type LoginForm = z.infer<typeof loginSchema>;
export type OperatorForm = z.infer<typeof operatorSchema>;
export type ChecklistForm = z.infer<typeof checklistSchema>;
export type SafetyAlertForm = z.infer<typeof safetyAlertSchema>;
export type AlertResponseForm = z.infer<typeof alertResponseSchema>;
export type PreOperationForm = z.infer<typeof preOperationSchema>;
export type ActivityForm = z.infer<typeof activitySchema>;
