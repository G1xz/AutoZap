/**
 * Testes para o sistema de validações
 */

import { describe, it, expect } from '@jest/globals'
import {
  emailSchema,
  passwordSchema,
  phoneSchema,
  registerSchema,
  validate,
  safeValidate,
} from '../validations'

describe('Validações', () => {
  describe('emailSchema', () => {
    it('deve aceitar email válido', () => {
      expect(() => validate(emailSchema, 'test@example.com')).not.toThrow()
    })

    it('deve rejeitar email inválido', () => {
      expect(() => validate(emailSchema, 'invalid-email')).toThrow()
    })
  })

  describe('passwordSchema', () => {
    it('deve aceitar senha com 6 ou mais caracteres', () => {
      expect(() => validate(passwordSchema, '123456')).not.toThrow()
    })

    it('deve rejeitar senha com menos de 6 caracteres', () => {
      expect(() => validate(passwordSchema, '12345')).toThrow()
    })
  })

  describe('phoneSchema', () => {
    it('deve aceitar telefone válido', () => {
      expect(() => validate(phoneSchema, '5511999999999')).not.toThrow()
    })

    it('deve rejeitar telefone inválido', () => {
      expect(() => validate(phoneSchema, 'abc123')).toThrow()
    })
  })

  describe('registerSchema', () => {
    it('deve aceitar dados válidos', () => {
      const data = {
        name: 'João Silva',
        email: 'joao@example.com',
        password: '123456',
      }
      expect(() => validate(registerSchema, data)).not.toThrow()
    })

    it('deve rejeitar dados inválidos', () => {
      const data = {
        name: 'J',
        email: 'invalid',
        password: '123',
      }
      expect(() => validate(registerSchema, data)).toThrow()
    })
  })

  describe('safeValidate', () => {
    it('deve retornar success: true para dados válidos', () => {
      const result = safeValidate(emailSchema, 'test@example.com')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('test@example.com')
      }
    })

    it('deve retornar success: false para dados inválidos', () => {
      const result = safeValidate(emailSchema, 'invalid')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })
  })
})

