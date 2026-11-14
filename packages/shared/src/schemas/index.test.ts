import { describe, expect, it } from 'vitest';
import {
  activitySchema,
  loginSchema,
  operatorSchema,
  safetyAlertSchema,
} from './index';

describe('loginSchema', () => {
  it('aceita credenciais válidas', () => {
    const result = loginSchema.safeParse({
      email: 'op@marrua.com',
      password: 'Senha123',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita senha sem maiúscula', () => {
    const result = loginSchema.safeParse({
      email: 'op@marrua.com',
      password: 'senha123',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita email inválido', () => {
    const result = loginSchema.safeParse({
      email: 'nao-e-email',
      password: 'Senha123',
    });
    expect(result.success).toBe(false);
  });
});

describe('operatorSchema', () => {
  it('telefone é opcional', () => {
    const result = operatorSchema.safeParse({
      name: 'João',
      email: 'joao@marrua.com',
      password: 'Senha123',
      phone: '',
    });
    expect(result.success).toBe(true);
  });
});

describe('safetyAlertSchema', () => {
  it('rejeita severidade desconhecida', () => {
    const result = safetyAlertSchema.safeParse({
      title: 'Alerta',
      message: 'Mensagem longa o suficiente',
      severity: 'urgente',
    });
    expect(result.success).toBe(false);
  });
});

describe('activitySchema', () => {
  it('exige local e descrição mínimos', () => {
    expect(activitySchema.safeParse({ location: 'A', description: 'ab' }).success).toBe(false);
    expect(activitySchema.safeParse({ location: 'Pátio', description: 'Carregamento' }).success).toBe(true);
  });
});
