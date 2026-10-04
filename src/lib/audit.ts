/**
 * Audit Logger - Logging estructurado para Sentry
 * 
 * Uso:
 *   import { auditLog } from '@/lib/audit';
 *   await auditLog('invoice.created', { invoiceId, amount, clientId }, userId);
 */

import * as Sentry from '@sentry/nextjs';

export type AuditAction =
  | 'user.login'
  | 'user.logout'
  | 'user.failed_login'
  | 'invoice.created'
  | 'invoice.updated'
  | 'invoice.deleted'
  | 'invoice.sent'
  | 'payment.received'
  | 'payment.refunded'
  | 'credit.applied'
  | 'credit.refunded'
  | 'return.created'
  | 'return.completed'
  | 'return.cancelled'
  | 'settings.updated'
  | 'config.smtp_changed'
  | 'config.ai_keys_changed'
  | 'product.created'
  | 'product.updated'
  | 'product.deleted'
  | 'client.created'
  | 'client.updated'
  | 'client.deleted';

export interface AuditContext {
  userId?: string;
  entityId?: string;
  entityType?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Registra un evento de auditoría en Sentry
 */
export async function auditLog(
  action: AuditAction,
  context: AuditContext = {}
): Promise<void> {
  const { userId, entityId, entityType, oldValue, newValue, ip, userAgent, metadata } = context;

  // Solo enviar a Sentry si está configurado (producción)
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.addBreadcrumb({
      category: 'audit',
      message: action,
      level: 'info',
      data: {
        userId,
        entityId,
        entityType,
        oldValue,
        newValue,
        ip,
        userAgent,
        ...metadata,
      },
    });

    // También capturar como evento para alertas en acciones críticas
    const criticalActions: AuditAction[] = [
      'user.failed_login',
      'invoice.deleted',
      'payment.refunded',
      'return.cancelled',
      'settings.updated',
      'config.smtp_changed',
      'config.ai_keys_changed',
    ];

    if (criticalActions.includes(action)) {
      Sentry.captureMessage(`Audit: ${action}`, {
        level: 'warning',
        tags: { audit_action: action },
        extra: { ...context, timestamp: new Date().toISOString() },
      });
    }
  }

  // Siempre log en consola (desarrollo) y logs de Vercel
  console.info('[AUDIT]', {
    action,
    timestamp: new Date().toISOString(),
    userId: userId || 'anonymous',
    entityId,
    entityType,
    ...metadata,
  });
}

/**
 * Helper para logging de errores de auditoría
 */
export function auditError(
  action: AuditAction,
  error: Error,
  context: AuditContext = {}
): void {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureException(error, {
      tags: { audit_action: action, audit_failed: 'true' },
      extra: { ...context, timestamp: new Date().toISOString() },
    });
  }
  console.error('[AUDIT ERROR]', { action, error: error.message, ...context });
}