'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface AgreementSummary {
  id: string;
  status?: string;
  monthlyRent?: number;
  displayTitle?: string;
  tenantName?: string;
  landlordName?: string;
  property?: {
    id?: string;
    title?: string;
    address?: string;
  };
  tenant?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
  };
  landlord?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
  };
  startDate?: string;
  endDate?: string;
}

interface AgreementsResponse {
  data?: AgreementSummary[];
  meta?: { total: number };
}

function formatPersonName(person?: {
  firstName?: string;
  lastName?: string;
  name?: string;
}) {
  if (!person) return 'Unknown';
  if (person.name) return person.name;
  return (
    [person.firstName, person.lastName].filter(Boolean).join(' ') || 'Unknown'
  );
}

export function useUserAgreements() {
  return useQuery({
    queryKey: ['agreements', 'mine'],
    queryFn: async () => {
      const response = await apiClient.get<AgreementsResponse>(
        '/agreements?limit=50',
      );
      const list = response.data.data ?? [];
      return list.map((agreement) => ({
        ...agreement,
        displayTitle:
          agreement.property?.title ??
          agreement.property?.address ??
          `Agreement ${agreement.id.slice(0, 8)}`,
        tenantName: formatPersonName(agreement.tenant),
        landlordName: formatPersonName(agreement.landlord),
      }));
    },
    staleTime: 60_000,
  });
}

export function useAgreement(agreementId: string) {
  return useQuery({
    queryKey: ['agreements', agreementId],
    enabled: Boolean(agreementId),
    queryFn: async () => {
      const response = await apiClient.get<AgreementSummary>(
        `/agreements/${agreementId}`,
      );
      const agreement = response.data;
      return {
        ...agreement,
        displayTitle:
          agreement.property?.title ??
          agreement.property?.address ??
          `Agreement ${agreement.id.slice(0, 8)}`,
        tenantName: formatPersonName(agreement.tenant),
        landlordName: formatPersonName(agreement.landlord),
      };
    },
  });
}
