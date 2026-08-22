export interface Customer {
  id: string;
  userId: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerFilter {
  q?: string;
  active?: boolean;
  page: number;
  perPage: number;
}

export interface CustomerPage {
  items: Customer[];
  page: number;
  perPage: number;
  total: number;
}

export interface CreateCustomerInput {
  userId?: string | null;
  fullName: string;
  email: string;
  phone?: string | null;
  active?: boolean;
}

export interface UpdateCustomerInput {
  fullName?: string;
  email?: string;
  phone?: string | null;
  active?: boolean;
}

export interface CustomerAddress {
  id: string;
  customerId: string;
  label: string;
  recipientName: string;
  phone: string | null;
  street: string;
  number: string;
  apartment: string | null;
  city: string;
  province: string;
  postalCode: string;
  reference: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomerAddressInput {
  label: string;
  recipientName: string;
  phone?: string | null;
  street: string;
  number: string;
  apartment?: string | null;
  city: string;
  province: string;
  postalCode: string;
  reference?: string | null;
  isDefault?: boolean;
}

export type UpdateCustomerAddressInput = Partial<CreateCustomerAddressInput>;
