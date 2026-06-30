'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '../keys';
import type { Payment, PaginatedResponse, PaymentMethod } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PaymentListParams {
  page?: number;
  limit?: number;
  status?: Payment['status'];
  agreementId?: string;
  startDate?: string;
  endDate?: string;
}

interface CreatePaymentPayload {
  agreementId: string;
  amount: number;
  currency: string;
  paymentMethod: Payment['paymentMethod'];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildQueryString(params: PaymentListParams): string {
  const qs = new URLSearchParams();
  if (params.page) qs.append('page', String(params.page));
  if (params.limit) qs.append('limit', String(params.limit));
  if (params.status) qs.append('status', params.status);
  if (params.agreementId) qs.append('agreementId', params.agreementId);
  if (params.startDate) qs.append('startDate', params.startDate);
  if (params.endDate) qs.append('endDate', params.endDate);
  const str = qs.toString();
  return str ? `?${str}` : '';
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Fetch a paginated list of payments with optional filters.
 */
export function usePayments(params: PaymentListParams = {}) {
  return useQuery({
    queryKey: queryKeys.payments.list(params),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Payment>>(
        `/payments${buildQueryString(params)}`,
      );
      return data;
    },
  });
}

/**
 * Fetch a single payment by ID.
 */
export function usePayment(id: string | null) {
  return useQuery({
    queryKey: queryKeys.payments.detail(id ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<Payment>(`/payments/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

/**
 * Fetch payments associated with a specific rental agreement.
 */
export function usePaymentsByAgreement(agreementId: string | null) {
  return useQuery({
    queryKey: queryKeys.payments.byAgreement(agreementId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<Payment[]>(
        `/payments?agreementId=${agreementId}`,
      );
      return data;
    },
    enabled: Boolean(agreementId),
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/**
 * Initiate a new payment. Invalidates payments, agreements, and transactions
 * (cross-domain) via the cache invalidation dependency map.
 */
export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreatePaymentPayload) => {
      const { data } = await apiClient.post<Payment>('/payments', payload);
      return data;
    },
    onSuccess: (created) => {
      // Bust payments + cross-domain deps (agreements, transactions).
      [
        queryKeys.payments.all,
        queryKeys.agreements.all,
        queryKeys.transactions.all,
      ].forEach((key) => queryClient.invalidateQueries({ queryKey: key }));

      if (created.agreementId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.payments.byAgreement(created.agreementId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.agreements.detail(created.agreementId),
        });
      }
    },
  });
}

// ─── Payment Methods Hooks ──────────────────────────────────────────────────

export interface CreatePaymentMethodPayload {
  paymentType: string;
  lastFour?: string;
  expiryDate?: string;
  isDefault?: boolean;
  metadata?: Record<string, unknown>;
  sensitiveMetadata?: Record<string, unknown>;
}

export function usePaymentMethods(params: { isDefault?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.paymentMethods.list(params),
    queryFn: async () => {
      const qs = params.isDefault !== undefined ? `?isDefault=${params.isDefault}` : '';
      const { data } = await apiClient.get<PaymentMethod[]>(
        `/payment-methods${qs}`,
      );
      return data;
    },
  });
}

export function useCreatePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreatePaymentMethodPayload) => {
      const { data } = await apiClient.post<PaymentMethod>(
        '/payment-methods',
        payload,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods.all });
    },
  });
}

export function useDeletePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.delete<{ success: boolean }>(
        `/payment-methods/${id}`,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods.all });
    },
  });
}
