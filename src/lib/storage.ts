import { Client, Payment } from '@/types/client';
import { addMonths, differenceInDays, parseISO, format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

const CLIENTS_KEY = 'consultoria_clients';
const PAYMENTS_KEY = 'consultoria_payments';

export const getClients = (): Client[] => {
  const data = localStorage.getItem(CLIENTS_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveClients = (clients: Client[]) => {
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
};

export const addClient = (client: Omit<Client, 'id' | 'createdAt'>): Client => {
  const clients = getClients();
  const newClient: Client = {
    ...client,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  clients.push(newClient);
  saveClients(clients);
  
  // Generate payments for this client
  generatePaymentsForClient(newClient);
  
  return newClient;
};

export const updateClient = (id: string, updates: Partial<Client>): Client | null => {
  const clients = getClients();
  const index = clients.findIndex(c => c.id === id);
  if (index === -1) return null;
  
  clients[index] = { ...clients[index], ...updates };
  saveClients(clients);
  return clients[index];
};

export const deleteClient = (id: string) => {
  const clients = getClients();
  const filtered = clients.filter(c => c.id !== id);
  saveClients(filtered);
  
  // Remove associated payments
  const payments = getPayments();
  const filteredPayments = payments.filter(p => p.clientId !== id);
  savePayments(filteredPayments);
};

export const getPayments = (): Payment[] => {
  const data = localStorage.getItem(PAYMENTS_KEY);
  return data ? JSON.parse(data) : [];
};

export const savePayments = (payments: Payment[]) => {
  localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
};

export const generatePaymentsForClient = (client: Client) => {
  const payments = getPayments();
  const startDate = parseISO(client.startDate);
  const endDate = parseISO(client.endDate);
  
  let currentDate = startDate;
  while (currentDate <= endDate) {
    const existingPayment = payments.find(
      p => p.clientId === client.id && format(parseISO(p.dueDate), 'yyyy-MM') === format(currentDate, 'yyyy-MM')
    );
    
    if (!existingPayment) {
      const payment: Payment = {
        id: crypto.randomUUID(),
        clientId: client.id,
        clientName: client.name,
        amount: client.monthlyValue,
        dueDate: format(currentDate, 'yyyy-MM-dd'),
        status: 'pending',
      };
      payments.push(payment);
    }
    
    currentDate = addMonths(currentDate, 1);
  }
  
  savePayments(payments);
};

export const updatePaymentStatus = (id: string, status: Payment['status'], paidDate?: string) => {
  const payments = getPayments();
  const index = payments.findIndex(p => p.id === id);
  if (index === -1) return;
  
  payments[index] = { ...payments[index], status, paidDate };
  savePayments(payments);
};

export const getClientsExpiringWithin = (days: number): Client[] => {
  const clients = getClients();
  const today = new Date();
  
  return clients
    .filter(client => {
      if (!client.isActive) return false;
      const endDate = parseISO(client.endDate);
      const daysUntilExpiry = differenceInDays(endDate, today);
      return daysUntilExpiry >= 0 && daysUntilExpiry <= days;
    })
    .sort((a, b) => parseISO(a.endDate).getTime() - parseISO(b.endDate).getTime());
};

export const getUpcomingPayments = (days: number): Payment[] => {
  const payments = getPayments();
  const today = new Date();
  
  return payments
    .filter(payment => {
      if (payment.status === 'paid') return false;
      const dueDate = parseISO(payment.dueDate);
      const daysUntilDue = differenceInDays(dueDate, today);
      return daysUntilDue >= -30 && daysUntilDue <= days;
    })
    .map(payment => {
      const daysUntilDue = differenceInDays(parseISO(payment.dueDate), today);
      return {
        ...payment,
        status: daysUntilDue < 0 ? 'overdue' : payment.status,
      } as Payment;
    })
    .sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime());
};

export const getMonthlyRevenue = (year: number, month: number): { total: number; payments: Payment[] } => {
  const payments = getPayments();
  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd = endOfMonth(new Date(year, month));
  
  const monthPayments = payments.filter(payment => {
    const dueDate = parseISO(payment.dueDate);
    return isWithinInterval(dueDate, { start: monthStart, end: monthEnd });
  });
  
  const total = monthPayments.reduce((sum, p) => sum + p.amount, 0);
  
  return { total, payments: monthPayments };
};

export const getTotalMonthlyRecurring = (): number => {
  const clients = getClients().filter(c => c.isActive);
  return clients.reduce((sum, c) => sum + c.monthlyValue, 0);
};
