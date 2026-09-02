"use client"

/**
 * Compatibility shim for shadcn/ui-style `useToast()` hook.
 * Wraps the underlying toast primitive to provide a familiar API.
 */
import { toast as toastPrimitive } from '@/components/ui/toast'

interface ToastOptions {
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
  duration?: number
}

function toast(options: ToastOptions) {
  const isError = options.variant === 'destructive'
  toastPrimitive.add({
    title: options.title ?? (isError ? 'Error' : 'Información'),
    description: options.description,
    ...(options.duration ? { timeout: options.duration } : {}),
  })
}

export function useToast() {
  return { toast }
}

export { toast }
