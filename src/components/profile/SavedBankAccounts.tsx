import { useState } from 'react';
import { useSavedBankAccounts } from '@/hooks/useSavedBankAccounts';
import { mockPayoutAdapter, NIGERIAN_BANKS, type Bank } from '@/adapters';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Plus, Star, Trash2, Loader2, Check } from 'lucide-react';

export const SavedBankAccounts = () => {
  const { accounts, loading, addAccount, setDefault, removeAccount } = useSavedBankAccounts();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setSelectedBank(null);
    setAccountNumber('');
    setAccountName(null);
    setIsVerified(false);
    setIsVerifying(false);
  };

  const handleVerify = async () => {
    if (!selectedBank || accountNumber.length !== 10) return;
    setIsVerifying(true);
    try {
      const result = await mockPayoutAdapter.verifyAccount(accountNumber, selectedBank.code);
      if (result.isValid) {
        setAccountName(result.accountName);
        setIsVerified(true);
      } else {
        toast({ title: 'Verification failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error verifying account', variant: 'destructive' });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSave = async () => {
    if (!selectedBank || !accountName || !isVerified) return;
    setSaving(true);
    const { error } = await addAccount({
      bankName: selectedBank.name,
      bankCode: selectedBank.code,
      accountNumber,
      accountName,
      setAsDefault: accounts.length === 0,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Error saving account', variant: 'destructive' });
    } else {
      toast({ title: 'Bank account saved!' });
      setAddOpen(false);
      resetForm();
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await removeAccount(deleteId);
    setDeleteId(null);
    toast({ title: 'Account removed' });
  };

  return (
    <>
      <Card className="glass-card border-border/50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-muted-foreground" />
              <p className="text-sm font-medium">Bank Accounts</p>
            </div>
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => { resetForm(); setAddOpen(true); }}>
              <Plus className="w-3.5 h-3.5" />
              Add
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : accounts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No saved bank accounts. Add one to speed up withdrawals.</p>
          ) : (
            <div className="space-y-2">
              {accounts.map(acc => (
                <div key={acc.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{acc.bank_name}</p>
                      {acc.is_default && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5">
                          <Star className="w-2.5 h-2.5" />
                          Default
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{acc.account_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{acc.account_number}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!acc.is_default && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDefault(acc.id)}>
                          <Star className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(acc.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Bank Account Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => { if (!open) { setAddOpen(false); resetForm(); } else setAddOpen(true); }}>
        <DialogContent className="glass-card max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Bank Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Select Bank</Label>
              <Select onValueChange={(code) => {
                const bank = NIGERIAN_BANKS.find(b => b.code === code);
                setSelectedBank(bank || null);
                setIsVerified(false);
                setAccountName(null);
              }} value={selectedBank?.code || ''}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose your bank" />
                </SelectTrigger>
                <SelectContent>
                  {NIGERIAN_BANKS.map(bank => (
                    <SelectItem key={bank.code} value={bank.code}>{bank.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Account Number</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="10-digit account number"
                  value={accountNumber}
                  onChange={(e) => {
                    setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10));
                    setIsVerified(false);
                    setAccountName(null);
                  }}
                  maxLength={10}
                />
                <Button variant="outline" onClick={handleVerify} disabled={!selectedBank || accountNumber.length !== 10 || isVerifying}>
                  {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                </Button>
              </div>
            </div>
            {isVerified && accountName && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
                <Check className="w-4 h-4 text-success" />
                <div>
                  <p className="text-xs text-muted-foreground">Account Name</p>
                  <p className="font-medium text-sm text-success">{accountName}</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); resetForm(); }}>Cancel</Button>
            <Button className="gradient-primary" onClick={handleSave} disabled={!isVerified || saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent className="glass-card max-w-[90vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Bank Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This bank account will be removed from your saved accounts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
