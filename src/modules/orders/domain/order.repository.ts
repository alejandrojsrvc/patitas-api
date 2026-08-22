import type {
  CreateOrderInput,
  Order,
  OrderFilter,
  OrderPage,
  RegisterPaymentInput,
  UpdateOrderInput,
} from './order.types';

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');

export interface OrderRepository {
  list(filter: OrderFilter): Promise<OrderPage>;
  findById(id: string): Promise<Order | null>;
  create(input: CreateOrderInput): Promise<Order>;
  update(id: string, input: UpdateOrderInput): Promise<Order>;
  registerPayment(id: string, input: RegisterPaymentInput): Promise<Order>;
  transition(id: string, status: Order['status']): Promise<Order>;
}
