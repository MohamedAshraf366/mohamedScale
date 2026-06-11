// components/orders/FinanceTab.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DollarSign, CreditCard, Building2, ReceiptText, Plus, Minus,
  CheckCircle2, Lock, RefreshCw, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useRecordCustomerPayment } from '@/hooks/useOperations';
import { toast } from 'sonner';
import { fmtCurrency, fmtDate, logGateEvent } from '@/lib/utils';

interface FinanceTabProps {
  order: any;
  onRefresh: () => void;
}

export function FinanceTab({ order, onRefresh }: FinanceTabProps) {
  const recordPayment = useRecordCustomerPayment();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showSupplierPaymentDialog, setShowSupplierPaymentDialog] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [selectedPoForPayment, setSelectedPoForPayment] = useState<any>(null);
  const [supplierPaymentForm, setSupplierPaymentForm] = useState({ amount: '', reference: '', notes: '', method: 'bank_transfer' });
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'bank_transfer', reference: '', notes: '' });
  const [payments, setPayments] = useState<any[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [isRecordingCustomerPayment, setIsRecordingCustomerPayment] = useState(false);
  const [isRecordingSupplierPayment, setIsRecordingSupplierPayment] = useState(false);
  
  const [showAddMethodDialog, setShowAddMethodDialog] = useState(false);
  const [newMethodName, setNewMethodName] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<string[]>([
    'bank_transfer',
    'cash',
    'visa',
    'mastercard',
    'mada',
    'cheque',
  ]);

  // Collapsible states
  const [isSupplierSectionOpen, setIsSupplierSectionOpen] = useState(false);
  const [isCustomerSectionOpen, setIsCustomerSectionOpen] = useState(false);

  const getMethodDisplay = (method: string) => {
    const methods: Record<string, { label: string; icon: string; color: string }> = {
      bank_transfer: { label: '🏦 Bank Transfer', icon: '🏦', color: 'text-blue-600' },
      cash: { label: '💵 Cash', icon: '💵', color: 'text-green-600' },
      visa: { label: '💳 Visa', icon: '💳', color: 'text-indigo-600' },
      mastercard: { label: '💳 Mastercard', icon: '💳', color: 'text-orange-600' },
      mada: { label: '💳 Mada', icon: '💳', color: 'text-emerald-600' },
      cheque: { label: '📝 Cheque', icon: '📝', color: 'text-purple-600' },
    };
    return methods[method] || { label: method, icon: '💰', color: 'text-gray-600' };
  };

  const orderTotal = order.total ?? 0;

  // جلب تاريخ المدفوعات
  const fetchPaymentHistory = async () => {
    setIsLoadingPayments(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          purchase_orders: purchase_order_id (
            po_number,
            total_amount,
            supplier_id
          )
        `)
        .eq('order_id', order.id)
        .order('paid_at', { ascending: false });
      
      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error('Failed to load payment history');
    } finally {
      setIsLoadingPayments(false);
    }
  };

  useEffect(() => {
    if (order.id) {
      fetchPaymentHistory();
    }
  }, [order.id]);

  // فصل المدفوعات حسب الاتجاه
  const incomingPayments = payments.filter(p => p.direction === 'in');
  const outgoingPayments = payments.filter(p => p.direction === 'out');
  
  const totalIncoming = incomingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalOutgoing = outgoingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  // حساب المبالغ المستحقة لكل مورد
  const supplierBalances = useMemo(() => {
    const balances: Record<string, { 
      supplierId: string; 
      supplierName: string; 
      totalAmount: number; 
      paidAmount: number; 
      remaining: number;
      pos: any[];
    }> = {};

    order.purchase_orders?.forEach((po: any) => {
      const supplierId = po.supplier_id;
      const supplierName = po.suppliers?.accounts?.display_name || po.supplier_name || 'Unknown Supplier';
      const poAmount = po.total_amount || 0;
      
      const poPayments = outgoingPayments.filter(p => p.purchase_order_id === po.id);
      const poPaid = poPayments.reduce((sum, p) => sum + p.amount, 0);
      const poRemaining = Math.max(0, poAmount - poPaid);

      if (!balances[supplierId]) {
        balances[supplierId] = {
          supplierId,
          supplierName,
          totalAmount: 0,
          paidAmount: 0,
          remaining: 0,
          pos: [],
        };
      }
      
      balances[supplierId].totalAmount += poAmount;
      balances[supplierId].paidAmount += poPaid;
      balances[supplierId].remaining += poRemaining;
      balances[supplierId].pos.push({ ...po, paidAmount: poPaid, remaining: poRemaining, payments: poPayments });
    });

    return Object.values(balances);
  }, [order.purchase_orders, outgoingPayments]);

  const totalSupplierInvoices = supplierBalances.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalSupplierPaid = supplierBalances.reduce((sum, s) => sum + s.paidAmount, 0);
  const totalSupplierRemaining = Math.max(0, totalSupplierInvoices - totalSupplierPaid);

  // ✅ المبلغ المتبقي للعميل (Balance Due)
  const customerBalance = Math.max(0, orderTotal - totalIncoming);
  const isCustomerFullyPaid = customerBalance <= 0;

  // ✅ قيمة الـ input تكون هي الـ Balance Due تلقائياً عند فتح الـ Dialog
  const openPaymentDialog = () => {
    setPaymentForm({
      amount: customerBalance.toString(),
      method: 'bank_transfer',
      reference: '',
      notes: ''
    });
    setShowPaymentDialog(true);
  };

  const canCloseOrder = isCustomerFullyPaid && totalSupplierRemaining <= 0;

  // ✅ دالة للتحقق من صحة المبلغ
  const validateAmount = (amount: number, maxAmount: number): number => {
    if (isNaN(amount) || amount <= 0) return 0;
    return Math.min(amount, maxAmount);
  };

  // ✅ دالة لتحديث مبلغ العميل - تمنع التعديل لأكبر من المتبقي
  const handleCustomerAmountChange = (value: string) => {
    let numValue = parseFloat(value);
    if (isNaN(numValue)) numValue = 0;
    // منع المبلغ من تجاوز المتبقي
    const validAmount = Math.min(numValue, customerBalance);
    setPaymentForm(f => ({ ...f, amount: validAmount.toString() }));
  };

  const handleSupplierAmountChange = (value: string) => {
    let numValue = parseFloat(value);
    if (isNaN(numValue)) numValue = 0;
    const maxAmount = selectedPoForPayment?.remaining || 0;
    const validAmount = Math.min(numValue, maxAmount);
    setSupplierPaymentForm(f => ({ ...f, amount: validAmount.toString() }));
  };

  const setMaxSupplierAmount = () => {
    const maxAmount = selectedPoForPayment?.remaining || 0;
    setSupplierPaymentForm(f => ({ ...f, amount: maxAmount.toString() }));
  };

  const addPaymentMethod = async () => {
    if (!newMethodName.trim()) {
      toast.error('Please enter a payment method name');
      return;
    }
    
    const methodKey = newMethodName.toLowerCase().replace(/\s+/g, '_');
    if (paymentMethods.includes(methodKey)) {
      toast.error('Payment method already exists');
      return;
    }
    
    setPaymentMethods([...paymentMethods, methodKey]);
    setNewMethodName('');
    setShowAddMethodDialog(false);
    toast.success(`Payment method "${newMethodName}" added successfully`);
  };

  const recordSupplierPayment = async (poId: string, amount: number) => {
    const po = supplierBalances.flatMap(s => s.pos).find(p => p.id === poId);
    if (po && amount > po.remaining) {
      toast.error(`Cannot pay more than remaining amount: ${fmtCurrency(po.remaining)}`);
      return;
    }

    setIsRecordingSupplierPayment(true);
    
    try {
      const { error } = await supabase
        .from('payments')
        .insert({
          order_id: order.id,
          amount: amount,
          currency: order.currency || 'SAR',
          method: supplierPaymentForm.method,
          reference: supplierPaymentForm.reference || null,
          paid_at: new Date().toISOString(),
          notes: supplierPaymentForm.notes || null,
          purchase_order_id: poId,
          direction: 'out',
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
      
      if (error) throw error;
      
      await supabase
        .from('orders')
        .update({ total_paid_to_suppliers: totalSupplierPaid + amount })
        .eq('id', order.id);
      
      await logGateEvent(order.id, 'G10', { 
        purchase_order_id: poId, 
        amount,
        reference: supplierPaymentForm.reference,
        method: supplierPaymentForm.method
      });
      
      toast.success(`Supplier payment recorded: ${fmtCurrency(amount)} via ${getMethodDisplay(supplierPaymentForm.method).label}`);
      await fetchPaymentHistory();
      onRefresh();
      setShowSupplierPaymentDialog(false);
      setSupplierPaymentForm({ amount: '', reference: '', notes: '', method: 'bank_transfer' });
      
    } catch (error: any) {
      toast.error(`Failed to record supplier payment: ${error.message}`);
    } finally {
      setIsRecordingSupplierPayment(false);
    }
  };

  const recordCustomerPaymentFunc = async () => {
    const amount = parseFloat(paymentForm.amount);
    
    if (amount > customerBalance) {
      toast.error(`Cannot pay more than remaining balance: ${fmtCurrency(customerBalance)}`);
      return;
    }
    
    if (amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsRecordingCustomerPayment(true);
    
    try {
      const { error } = await supabase
        .from('payments')
        .insert({
          order_id: order.id,
          amount: amount,
          currency: order.currency || 'SAR',
          method: paymentForm.method,
          reference: paymentForm.reference || null,
          paid_at: new Date().toISOString(),
          notes: paymentForm.notes || null,
          direction: 'in',
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
      
      if (error) throw error;
      
      await recordPayment.mutateAsync({ 
        orderId: order.id, 
        amount: amount, 
        method: paymentForm.method, 
        reference: paymentForm.reference, 
        notes: paymentForm.notes 
      });
      
      await logGateEvent(order.id, 'G11', { 
        amount: amount,
        method: paymentForm.method 
      });
      
      toast.success(`Customer payment recorded: ${fmtCurrency(amount)} via ${getMethodDisplay(paymentForm.method).label}`);
      setShowPaymentDialog(false);
      setPaymentForm({ amount: '', method: 'bank_transfer', reference: '', notes: '' });
      await fetchPaymentHistory();
      onRefresh();
      
    } catch (error: any) {
      toast.error(`Failed to record payment: ${error.message}`);
    } finally {
      setIsRecordingCustomerPayment(false);
    }
  };

  const getValidPercentage = (paid: number, total: number) => {
    if (total <= 0) return 0;
    return Math.min(100, Math.max(0, (paid / total) * 100));
  };

  return (
    <div className="space-y-4">
      {/* ============================================================ */}
      {/* 1. SUPPLIER PAYMENTS SECTION */}
      {/* ============================================================ */}
      <Card className="shadow-sm overflow-hidden">
        <div
          onClick={() => setIsSupplierSectionOpen(!isSupplierSectionOpen)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-1.5 rounded-lg transition-colors",
              isSupplierSectionOpen ? "bg-blue-500 text-white" : "bg-blue-100 text-blue-600"
            )}>
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <span className="font-semibold text-sm">Supplier Payments (Outgoing)</span>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-xs">
                  Total: {fmtCurrency(totalSupplierInvoices)}
                </Badge>
                <Badge variant="outline" className="text-xs text-emerald-600">
                  Paid: {fmtCurrency(totalSupplierPaid)}
                </Badge>
                {totalSupplierRemaining > 0 && (
                  <Badge variant="outline" className="text-xs text-amber-600">
                    Remaining: {fmtCurrency(totalSupplierRemaining)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            {totalSupplierInvoices > 0 && (
              <span className="text-xs font-medium">
                {getValidPercentage(totalSupplierPaid, totalSupplierInvoices).toFixed(0)}% paid
              </span>
            )}
            {isSupplierSectionOpen ? (
              <Minus className="h-4 w-4 transition-transform" />
            ) : (
              <Plus className="h-4 w-4 transition-transform group-hover:scale-110" />
            )}
          </div>
        </div>
        
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            isSupplierSectionOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="border-t p-4 space-y-4">
            {totalSupplierInvoices > 0 && (
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">Total Supplier Payment Progress</span>
                  <span className="font-medium">{getValidPercentage(totalSupplierPaid, totalSupplierInvoices).toFixed(0)}%</span>
                </div>
                <Progress value={getValidPercentage(totalSupplierPaid, totalSupplierInvoices)} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>Paid: {fmtCurrency(totalSupplierPaid)}</span>
                  <span>Remaining: {fmtCurrency(totalSupplierRemaining)}</span>
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              <p className="text-sm font-semibold">Supplier Breakdown</p>
              {supplierBalances.map((supplier) => (
                <Card key={supplier.supplierId} className="border shadow-sm">
                  <CardContent className="p-3">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <p className="font-medium">{supplier.supplierName}</p>
                        <p className="text-xs text-muted-foreground">
                          Total PO Value: {fmtCurrency(supplier.totalAmount)}
                        </p>
                      </div>
                      <Badge variant={supplier.remaining > 0 ? "outline" : "default"} 
                        className={supplier.remaining <= 0 ? "bg-green-100 text-green-700" : "text-amber-600"}>
                        {supplier.remaining <= 0 ? "✓ Fully Paid" : `${fmtCurrency(supplier.remaining)} remaining`}
                      </Badge>
                    </div>
                    
                    {supplier.totalAmount > 0 && (
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Payment Progress</span>
                          <span>{getValidPercentage(supplier.paidAmount, supplier.totalAmount).toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${getValidPercentage(supplier.paidAmount, supplier.totalAmount)}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-2 mt-2">
                      {supplier.pos.map((po: any) => (
                        <div key={po.id} className="bg-muted/20 rounded-lg p-2">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-xs font-mono font-medium">{po.po_number}</p>
                              <p className="text-xs text-muted-foreground">
                                Amount: {fmtCurrency(po.total_amount)}
                              </p>
                              {po.remaining > 0 && (
                                <p className="text-xs text-amber-600 mt-0.5">
                                  Remaining: {fmtCurrency(po.remaining)}
                                </p>
                              )}
                            </div>
                            {po.remaining > 0 ? (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-7 text-xs"
                                onClick={() => {
                                  setSelectedPoForPayment(po);
                                  setSupplierPaymentForm({ amount: po.remaining.toString(), reference: '', notes: '', method: 'bank_transfer' });
                                  setShowSupplierPaymentDialog(true);
                                }}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Pay {fmtCurrency(po.remaining)}
                              </Button>
                            ) : (
                              <Badge variant="outline" className="text-green-600 text-xs">✓ Paid</Badge>
                            )}
                          </div>
                          {po.payments.length > 0 && (
                            <div className="mt-2 text-xs text-muted-foreground border-t pt-1">
                              <p className="font-medium mb-1">Payment History:</p>
                              {po.payments.map((p: any, idx: number) => (
                                <div key={idx} className="flex justify-between">
                                  <span>{fmtDate(p.paid_at)}</span>
                                  <span className="text-blue-600">{fmtCurrency(p.amount)}</span>
                                  <span className="text-[10px]">{getMethodDisplay(p.method).label}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {supplierBalances.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No purchase orders found
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ============================================================ */}
      {/* 2. CUSTOMER PAYMENT SECTION */}
      {/* ============================================================ */}
      <Card className="shadow-sm overflow-hidden">
        <div
          onClick={() => setIsCustomerSectionOpen(!isCustomerSectionOpen)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-1.5 rounded-lg transition-colors",
              isCustomerSectionOpen ? "bg-emerald-500 text-white" : "bg-emerald-100 text-emerald-600"
            )}>
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <span className="font-semibold text-sm">Customer Payment (Incoming)</span>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-xs">
                  Total: {fmtCurrency(orderTotal)}
                </Badge>
                <Badge variant="outline" className="text-xs text-emerald-600">
                  Received: {fmtCurrency(totalIncoming)}
                </Badge>
                {customerBalance > 0 && (
                  <Badge variant="outline" className="text-xs text-amber-600">
                    Balance: {fmtCurrency(customerBalance)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            {orderTotal > 0 && (
              <span className="text-xs font-medium">
                {getValidPercentage(totalIncoming, orderTotal).toFixed(0)}% paid
              </span>
            )}
            {isCustomerSectionOpen ? (
              <Minus className="h-4 w-4 transition-transform" />
            ) : (
              <Plus className="h-4 w-4 transition-transform group-hover:scale-110" />
            )}
          </div>
        </div>
        
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            isCustomerSectionOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="border-t p-4 space-y-4">
            {/* Progress Bar للعميل */}
            <div className={cn(
              "rounded-lg p-4",
              isCustomerFullyPaid ? "bg-green-50" : "bg-emerald-50"
            )}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">
                  {isCustomerFullyPaid ? "✓ Order Fully Paid" : "Payment Progress"}
                </span>
                <span className="font-bold text-lg">{getValidPercentage(totalIncoming, orderTotal).toFixed(0)}%</span>
              </div>
              <Progress value={getValidPercentage(totalIncoming, orderTotal)} className="h-2" />
              <div className="flex justify-between text-sm mt-3">
                <div>
                  <p className="text-xs text-muted-foreground">Order Total</p>
                  <p className="font-semibold">{fmtCurrency(orderTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Amount Received</p>
                  <p className="font-semibold text-emerald-600">{fmtCurrency(totalIncoming)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Balance Due</p>
                  <p className={cn("font-semibold", customerBalance > 0 ? "text-red-600" : "text-green-600")}>
                    {fmtCurrency(customerBalance)}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Payment History للعميل */}
            {incomingPayments.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2">Payment History</p>
                <div className="space-y-2">
                  {incomingPayments.map((payment, idx) => (
                    <div key={idx} className="border rounded-lg p-3 bg-muted/20">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium">{fmtDate(payment.paid_at)}</span>
                        <Badge className="bg-emerald-100 text-emerald-700">{fmtCurrency(payment.amount)}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>Method: {getMethodDisplay(payment.method).label}</p>
                        {payment.reference && <p>Reference: {payment.reference}</p>}
                        {payment.notes && <p>Notes: {payment.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Record Payment Button */}
            {!isCustomerFullyPaid && (
              <Button 
                className="w-full bg-emerald-600 hover:bg-emerald-700" 
                onClick={openPaymentDialog}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Record Customer Payment (G11) - Balance: {fmtCurrency(customerBalance)}
              </Button>
            )}
            
            {isCustomerFullyPaid && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  Customer has fully paid the order amount!
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </Card>

      {/* ============================================================ */}
      {/* 3. ORDER CLOSURE STATUS */}
      {/* ============================================================ */}
      {canCloseOrder && (
        <Card className="border-green-500/30 bg-green-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 rounded-full p-2">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-green-800">All Payments Completed! ✅</p>
                <p className="text-sm text-green-700 mt-0.5">
                  All suppliers have been paid and customer has fully paid. Order can now be closed.
                </p>
              </div>
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={async () => {
                  await supabase
                    .from('orders')
                    .update({ lifecycle_stage: 'closed', status: 'delivered' })
                    .eq('id', order.id);
                  await logGateEvent(order.id, 'G12');
                  toast.success('Order closed successfully');
                  onRefresh();
                }}
              >
                <Lock className="h-3.5 w-3.5 mr-1.5" />
                Close Order (G12)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sales Invoice Card */}
      {order.sales_invoice_number && (
        <Card className="shadow-sm border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-purple-600" />
              Sales Invoice
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice Number</span>
              <span className="font-mono font-medium">{order.sales_invoice_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice Amount</span>
              <span className="font-medium">{fmtCurrency(order.sales_invoice_amount, order.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice Date</span>
              <span>{fmtDate(order.sales_invoice_date)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* RECORD CUSTOMER PAYMENT DIALOG */}
      {/* ============================================================ */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-600" />
              Record Customer Payment (G11)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Alert className="border-emerald-200 bg-emerald-50">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <AlertDescription>
                Balance due: <strong>{fmtCurrency(customerBalance, order.currency)}</strong>
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Label>Amount <span className="text-red-500">*</span></Label>
              <Input 
                type="number" 
                value={paymentForm.amount} 
                onChange={(e) => handleCustomerAmountChange(e.target.value)} 
                max={customerBalance}
                step="0.01"
              />
              <p className="text-xs text-muted-foreground">
                Maximum allowed: {fmtCurrency(customerBalance)}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <div className="flex gap-2">
                <Select value={paymentForm.method} onValueChange={(v) => setPaymentForm(f => ({ ...f, method: v }))}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map(method => {
                      const display = getMethodDisplay(method);
                      return (
                        <SelectItem key={method} value={method}>
                          <span className="flex items-center gap-2">
                            <span>{display.icon}</span>
                            {display.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon"
                  onClick={() => setShowAddMethodDialog(true)}
                  title="Add new payment method"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Reference / Transaction ID</Label>
              <Input 
                value={paymentForm.reference} 
                onChange={(e) => setPaymentForm(f => ({ ...f, reference: e.target.value }))} 
                placeholder="e.g., Transfer receipt number, Cheque number, etc." 
              />
            </div>
            
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea 
                rows={2} 
                value={paymentForm.notes} 
                onChange={(e) => setPaymentForm(f => ({ ...f, notes: e.target.value }))} 
                placeholder="Additional notes..." 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>Cancel</Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={
                !paymentForm.amount || 
                parseFloat(paymentForm.amount) <= 0 || 
                parseFloat(paymentForm.amount) > customerBalance || 
                isRecordingCustomerPayment
              }
              onClick={recordCustomerPaymentFunc}
            >
              {isRecordingCustomerPayment ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Processing...
                </>
              ) : (
                'Record Payment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* RECORD SUPPLIER PAYMENT DIALOG */}
      {/* ============================================================ */}
      <Dialog open={showSupplierPaymentDialog} onOpenChange={setShowSupplierPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              Record Supplier Payment (G10)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Alert className="border-blue-200 bg-blue-50">
              <Building2 className="h-4 w-4 text-blue-600" />
              <AlertDescription>
                <strong>PO:</strong> {selectedPoForPayment?.po_number}<br />
                <strong>Remaining:</strong> {fmtCurrency(selectedPoForPayment?.remaining)}
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Amount <span className="text-red-500">*</span></Label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-xs"
                  onClick={setMaxSupplierAmount}
                >
                  Max
                </Button>
              </div>
              <Input 
                type="number" 
                value={supplierPaymentForm.amount} 
                onChange={(e) => handleSupplierAmountChange(e.target.value)} 
                max={selectedPoForPayment?.remaining}
                step="0.01"
              />
              <p className="text-xs text-muted-foreground">
                Maximum allowed: {fmtCurrency(selectedPoForPayment?.remaining)}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <div className="flex gap-2">
                <Select value={supplierPaymentForm.method} onValueChange={(v) => setSupplierPaymentForm(f => ({ ...f, method: v }))}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map(method => {
                      const display = getMethodDisplay(method);
                      return (
                        <SelectItem key={method} value={method}>
                          <span className="flex items-center gap-2">
                            <span>{display.icon}</span>
                            {display.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon"
                  onClick={() => setShowAddMethodDialog(true)}
                  title="Add new payment method"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input 
                value={supplierPaymentForm.reference} 
                onChange={(e) => setSupplierPaymentForm(f => ({ ...f, reference: e.target.value }))} 
              />
            </div>
            
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea 
                rows={2} 
                value={supplierPaymentForm.notes} 
                onChange={(e) => setSupplierPaymentForm(f => ({ ...f, notes: e.target.value }))} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSupplierPaymentDialog(false)}>Cancel</Button>
            <Button 
              disabled={
                !supplierPaymentForm.amount || 
                parseFloat(supplierPaymentForm.amount) <= 0 || 
                parseFloat(supplierPaymentForm.amount) > (selectedPoForPayment?.remaining || 0) || 
                isRecordingSupplierPayment
              }
              onClick={() => recordSupplierPayment(selectedPoForPayment?.id, parseFloat(supplierPaymentForm.amount))}
            >
              {isRecordingSupplierPayment ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Processing...
                </>
              ) : (
                'Record Payment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* ADD PAYMENT METHOD DIALOG */}
      {/* ============================================================ */}
      <Dialog open={showAddMethodDialog} onOpenChange={setShowAddMethodDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Add New Payment Method
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Add a custom payment method (e.g., Apple Pay, Google Pay, etc.)
            </p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Payment Method Name <span className="text-red-500">*</span></Label>
              <Input 
                value={newMethodName} 
                onChange={(e) => setNewMethodName(e.target.value)} 
                placeholder="e.g., Apple Pay, Google Pay, PayPal, etc."
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                This will appear in the payment method dropdown
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMethodDialog(false)}>Cancel</Button>
            <Button 
              className="bg-primary hover:bg-primary/90"
              disabled={!newMethodName.trim()}
              onClick={addPaymentMethod}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Method
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}