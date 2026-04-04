import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Expense = {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  note?: string;
};

type TabKey = 'dashboard' | 'add' | 'expenses' | 'settings';

const STORAGE_KEY = 'expenseflow-expenses';
const categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Travel'];
const quickAmounts = [5, 10, 20, 50, 100, 500];
const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'dashboard', label: 'Overview' },
  { key: 'add', label: 'Capture' },
  { key: 'expenses', label: 'Activity' },
  { key: 'settings', label: 'Settings' },
];

const emptyForm = () => ({
  title: '',
  amount: '',
  category: categories[0],
  date: new Date().toISOString().slice(0, 10),
  note: '',
});

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [lastAddedExpense, setLastAddedExpense] = useState<Expense | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  useEffect(() => {
    const loadExpenses = async () => {
      try {
        const storedExpenses = await AsyncStorage.getItem(STORAGE_KEY);
        if (storedExpenses) {
          setExpenses(JSON.parse(storedExpenses) as Expense[]);
        }
      } catch {
        Alert.alert('Storage error', 'Saved expenses could not be loaded.');
      } finally {
        setIsLoaded(true);
      }
    };

    void loadExpenses();
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    const persistExpenses = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
      } catch {
        Alert.alert('Storage error', 'Expenses could not be saved on this device.');
      }
    };

    void persistExpenses();
  }, [expenses, isLoaded]);

  const monthKey = new Date().toISOString().slice(0, 7);
  const monthExpenses = expenses.filter((expense) => expense.date.startsWith(monthKey));
  const totalThisMonth = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const recentExpenses = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const categoryTotals = categories
    .map((item) => ({
      category: item,
      total: monthExpenses
        .filter((expense) => expense.category === item)
        .reduce((sum, expense) => sum + expense.amount, 0),
    }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);
  const topCategory = categoryTotals[0];
  const monthlyExpenseCount = monthExpenses.length;
  const averageExpense = monthlyExpenseCount ? totalThisMonth / monthlyExpenseCount : 0;
  const numericAmount = Number(amount);
  const hasValidAmount = Number.isFinite(numericAmount) && numericAmount > 0;

  const resetForm = () => {
    const form = emptyForm();
    setEditingExpenseId(null);
    setTitle(form.title);
    setAmount(form.amount);
    setCategory(form.category);
    setDate(form.date);
    setNote(form.note);
  };

  const buildExpensePayload = (value: number) => ({
    id: editingExpenseId ?? `${Date.now()}`,
    title: title.trim(),
    amount: value,
    category,
    date,
    note: note.trim(),
  });

  const saveExpense = (expensePayload: Expense) => {
    setExpenses((current) => {
      if (!editingExpenseId) {
        return [expensePayload, ...current];
      }

      return current.map((expense) => (expense.id === editingExpenseId ? expensePayload : expense));
    });

    setLastAddedExpense(editingExpenseId ? null : expensePayload);
    resetForm();
    setActiveTab('expenses');
  };

  const handleSaveExpense = () => {
    const parsedAmount = Number(amount);

    if (!title.trim()) {
      Alert.alert('Title required', 'Enter a short expense title.');
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid amount greater than zero.');
      return;
    }

    saveExpense(buildExpensePayload(parsedAmount));
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpenseId(expense.id);
    setTitle(expense.title);
    setAmount(expense.amount.toString());
    setCategory(expense.category);
    setDate(expense.date);
    setNote(expense.note ?? '');
    setActiveTab('add');
  };

  const handleDeleteExpense = (id: string) => {
    setExpenses((current) => current.filter((expense) => expense.id !== id));
    if (lastAddedExpense?.id === id) {
      setLastAddedExpense(null);
    }
    if (editingExpenseId === id) {
      resetForm();
    }
  };

  const handleQuickAmount = (value: number) => {
    setAmount(value.toString());
  };

  const handleQuickSave = (value: number) => {
    const nextTitle = title.trim();
    if (!nextTitle) {
      Alert.alert('Title required', 'Add a short title before using quick save.');
      return;
    }

    saveExpense({
      id: `${Date.now()}`,
      title: nextTitle,
      amount: value,
      category,
      date,
      note: note.trim(),
    });
  };

  const handleUndoLastAdd = () => {
    if (!lastAddedExpense) {
      return;
    }

    setExpenses((current) => current.filter((expense) => expense.id !== lastAddedExpense.id));
    setLastAddedExpense(null);
  };

  const handleResetAll = () => {
    Alert.alert('Reset all expenses', 'This will remove every saved expense from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset all',
        style: 'destructive',
        onPress: () => {
          setExpenses([]);
          setLastAddedExpense(null);
          resetForm();
        },
      },
    ]);
  };

  return (
    <View style={styles.appShell}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <View>
            <Text style={styles.kicker}>SmartSpend</Text>
            <Text style={styles.screenTitle}>Spend with clarity.</Text>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{isLoaded ? 'Offline saved' : 'Loading'}</Text>
          </View>
        </View>

        {activeTab === 'dashboard' ? (
          <>
            <View style={styles.heroPanel}>
              <Text style={styles.heroEyebrow}>This month</Text>
              <Text style={styles.heroAmount}>${totalThisMonth.toFixed(2)}</Text>
              <Text style={styles.heroSubtext}>
                {monthlyExpenseCount === 0
                  ? 'Start tracking with your first expense.'
                  : `${monthlyExpenseCount} expenses captured so far.`}
              </Text>
              <View style={styles.heroMetricsRow}>
                <MetricPill label="Average" value={`$${averageExpense.toFixed(0)}`} />
                <MetricPill label="Top" value={topCategory?.category ?? 'None'} />
              </View>
            </View>

            <View style={styles.statGrid}>
              <InfoCard label="Transactions" value={`${monthlyExpenseCount}`} note="Current month" />
              <InfoCard label="Storage" value="Local" note="This device only" />
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Category pace</Text>
                <Text style={styles.sectionCaption}>Month view</Text>
              </View>
              {categoryTotals.length === 0 ? (
                <EmptyState title="No spending yet" text="Your category mix will appear here once you add a few entries." />
              ) : (
                categoryTotals.slice(0, 4).map((item) => (
                  <CategoryBar
                    key={item.category}
                    category={item.category}
                    total={item.total}
                    max={categoryTotals[0].total}
                  />
                ))
              )}
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent activity</Text>
                <Pressable onPress={() => setActiveTab('expenses')}>
                  <Text style={styles.inlineLink}>Open all</Text>
                </Pressable>
              </View>
              {recentExpenses.length === 0 ? (
                <EmptyState title="Nothing captured" text="Use the Capture tab to log your first expense." />
              ) : (
                recentExpenses.slice(0, 3).map((expense) => (
                  <ExpenseCard
                    key={expense.id}
                    compact
                    expense={expense}
                    onDelete={handleDeleteExpense}
                    onEdit={handleEditExpense}
                  />
                ))
              )}
            </View>
          </>
        ) : null}

        {activeTab === 'add' ? (
          <>
            <View style={styles.captureHeaderCard}>
              <Text style={styles.captureTitle}>{editingExpenseId ? 'Edit entry' : 'Capture expense'}</Text>
              <Text style={styles.captureHint}>Quick buttons for speed, full form for control.</Text>
              <Text style={styles.captureAmount}>${hasValidAmount ? numericAmount.toFixed(2) : '0.00'}</Text>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Quick amounts</Text>
                <Text style={styles.sectionCaption}>Hold to save</Text>
              </View>
              <View style={styles.quickAmountGrid}>
                {quickAmounts.map((value) => {
                  const isActive = amount === value.toString();
                  return (
                    <Pressable
                      key={value}
                      delayLongPress={300}
                      onLongPress={() => handleQuickSave(value)}
                      onPress={() => handleQuickAmount(value)}
                      style={[styles.quickAmountButton, isActive && styles.quickAmountButtonActive]}
                    >
                      <Text style={[styles.quickAmountText, isActive && styles.quickAmountTextActive]}>${value}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.actionRow}>
                <ActionButton disabled={!lastAddedExpense} label="Undo last add" onPress={handleUndoLastAdd} />
                <ActionButton destructive label="Reset all" onPress={handleResetAll} />
              </View>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Details</Text>
                <Text style={styles.sectionCaption}>{editingExpenseId ? 'Update current entry' : 'Manual entry'}</Text>
              </View>
              <Field label="Title" value={title} onChangeText={setTitle} placeholder="Groceries" />
              <Field
                label="Amount"
                value={amount}
                onChangeText={setAmount}
                placeholder="45.90"
                keyboardType="decimal-pad"
              />
              <Field label="Date" value={date} onChangeText={setDate} placeholder="2026-04-03" />
              <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional note" />
              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.categoryWrap}>
                {categories.map((item) => {
                  const isActive = item === category;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setCategory(item)}
                      style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                    >
                      <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>{item}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable onPress={handleSaveExpense} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>{editingExpenseId ? 'Update expense' : 'Save expense'}</Text>
              </Pressable>
              {editingExpenseId ? (
                <Pressable onPress={resetForm} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Cancel editing</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}

        {activeTab === 'expenses' ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>All activity</Text>
              <Text style={styles.sectionCaption}>{expenses.length} items</Text>
            </View>
            {expenses.length === 0 ? (
              <EmptyState title="No expenses yet" text="Capture something from the Capture tab and it will appear here." />
            ) : (
              [...expenses]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((expense) => (
                  <ExpenseCard key={expense.id} expense={expense} onDelete={handleDeleteExpense} onEdit={handleEditExpense} />
                ))
            )}
          </View>
        ) : null}

        {activeTab === 'settings' ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Settings</Text>
              <Text style={styles.sectionCaption}>Local MVP</Text>
            </View>
            <SettingRow label="Mode" value="Offline" />
            <SettingRow label="Storage" value="This device only" />
            <SettingRow label="Editing" value="Enabled" />
            <SettingRow label="Current style" value="Finance dark" />
            <Text style={styles.supportText}>
              This version keeps everything local so the app stays simple while the UX gets refined.
            </Text>
            <Pressable onPress={handleResetAll} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Clear all expenses</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
            >
              <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'decimal-pad';
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#64748B"
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricPillLabel}>{label}</Text>
      <Text style={styles.metricPillValue}>{value}</Text>
    </View>
  );
}

function InfoCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
      <Text style={styles.infoNote}>{note}</Text>
    </View>
  );
}

function CategoryBar({
  category,
  total,
  max,
}: {
  category: string;
  total: number;
  max: number;
}) {
  const width = (max === 0 ? '0%' : `${Math.max(10, Math.round((total / max) * 100))}%`) as `${number}%`;

  return (
    <View style={styles.categoryBarRow}>
      <View style={styles.categoryBarHeader}>
        <Text style={styles.categoryBarTitle}>{category}</Text>
        <Text style={styles.categoryBarAmount}>${total.toFixed(2)}</Text>
      </View>
      <View style={styles.categoryBarTrack}>
        <View style={[styles.categoryBarFill, { width }]} />
      </View>
    </View>
  );
}

function ActionButton({
  destructive,
  disabled,
  label,
  onPress,
}: {
  destructive?: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.actionButton, disabled && styles.actionButtonDisabled]}
    >
      <Text style={[styles.actionButtonText, destructive && styles.actionButtonTextDanger]}>{label}</Text>
    </Pressable>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Text style={styles.settingValue}>{value}</Text>
    </View>
  );
}

function ExpenseCard({
  compact,
  expense,
  onDelete,
  onEdit,
}: {
  compact?: boolean;
  expense: Expense;
  onDelete: (id: string) => void;
  onEdit: (expense: Expense) => void;
}) {
  return (
    <View style={[styles.expenseCard, compact && styles.expenseCardCompact]}>
      <View style={styles.expenseMain}>
        <View style={styles.expenseTopLine}>
          <Text style={styles.expenseTitle}>{expense.title}</Text>
          <Text style={styles.expenseAmount}>${expense.amount.toFixed(2)}</Text>
        </View>
        <View style={styles.expenseMetaRow}>
          <Text style={styles.expenseChip}>{expense.category}</Text>
          <Text style={styles.expenseMeta}>{expense.date}</Text>
        </View>
        {expense.note ? <Text style={styles.expenseNote}>{expense.note}</Text> : null}
      </View>
      <View style={styles.expenseActions}>
        <Pressable onPress={() => onEdit(expense)}>
          <Text style={styles.editText}>Edit</Text>
        </Pressable>
        <Pressable onPress={() => onDelete(expense.id)}>
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  content: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 120,
    gap: 16,
  },
  topbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  kicker: {
    color: '#7C89A6',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  screenTitle: {
    color: '#F8FAFC',
    fontSize: 30,
    fontWeight: '700',
    marginTop: 6,
  },
  statusPill: {
    backgroundColor: '#131B2C',
    borderColor: '#202A3C',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusPillText: {
    color: '#A5B4FC',
    fontSize: 12,
    fontWeight: '700',
  },
  heroPanel: {
    backgroundColor: '#101827',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 28,
    padding: 24,
    gap: 12,
  },
  heroEyebrow: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  heroAmount: {
    color: '#FFFFFF',
    fontSize: 46,
    fontWeight: '700',
  },
  heroSubtext: {
    color: '#94A3B8',
    fontSize: 15,
    lineHeight: 22,
  },
  heroMetricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  metricPill: {
    flex: 1,
    backgroundColor: '#0B1220',
    borderColor: '#243041',
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 4,
  },
  metricPillLabel: {
    color: '#7C89A6',
    fontSize: 12,
    fontWeight: '600',
  },
  metricPillValue: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  statGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    gap: 6,
  },
  infoLabel: {
    color: '#7C89A6',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  infoValue: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '700',
  },
  infoNote: {
    color: '#94A3B8',
    fontSize: 13,
  },
  sectionCard: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
  },
  sectionCaption: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  inlineLink: {
    color: '#A5B4FC',
    fontSize: 14,
    fontWeight: '700',
  },
  categoryBarRow: {
    gap: 8,
  },
  categoryBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBarTitle: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '600',
  },
  categoryBarAmount: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  categoryBarTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#111827',
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#7C3AED',
  },
  emptyState: {
    backgroundColor: '#111827',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    gap: 6,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
  },
  captureHeaderCard: {
    backgroundColor: '#0D1424',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: 28,
    padding: 24,
    gap: 8,
  },
  captureTitle: {
    color: '#F8FAFC',
    fontSize: 26,
    fontWeight: '700',
  },
  captureHint: {
    color: '#94A3B8',
    fontSize: 14,
  },
  captureAmount: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '700',
    marginTop: 6,
  },
  quickAmountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickAmountButton: {
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: '#111827',
    borderColor: '#263244',
    borderWidth: 1,
  },
  quickAmountButtonActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  quickAmountText: {
    color: '#E2E8F0',
    fontSize: 18,
    fontWeight: '700',
  },
  quickAmountTextActive: {
    color: '#FFFFFF',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: '#111827',
    borderColor: '#263244',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionButtonText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
  },
  actionButtonTextDanger: {
    color: '#F87171',
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0B1220',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#F8FAFC',
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0B1220',
  },
  categoryChipActive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#F8FAFC',
  },
  categoryChipText: {
    color: '#CBD5E1',
    fontWeight: '700',
  },
  categoryChipTextActive: {
    color: '#0F172A',
  },
  primaryButton: {
    marginTop: 6,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#111827',
    borderColor: '#334155',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '700',
  },
  expenseCard: {
    flexDirection: 'row',
    gap: 14,
    borderRadius: 20,
    backgroundColor: '#111827',
    borderColor: '#1F2937',
    borderWidth: 1,
    padding: 16,
  },
  expenseCardCompact: {
    paddingVertical: 14,
  },
  expenseMain: {
    flex: 1,
    gap: 8,
  },
  expenseTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  expenseTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  expenseAmount: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  expenseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  expenseChip: {
    color: '#C4B5FD',
    backgroundColor: '#1C1630',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  expenseMeta: {
    color: '#94A3B8',
    fontSize: 13,
  },
  expenseNote: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },
  expenseActions: {
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    minWidth: 52,
  },
  editText: {
    color: '#A5B4FC',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '700',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  settingLabel: {
    color: '#94A3B8',
    fontSize: 15,
  },
  settingValue: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  supportText: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
  },
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    flexDirection: 'row',
    gap: 8,
    padding: 8,
    borderRadius: 22,
    backgroundColor: 'rgba(10,15,26,0.96)',
    borderColor: '#1F2937',
    borderWidth: 1,
  },
  tabButton: {
    flex: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  tabButtonActive: {
    backgroundColor: '#F8FAFC',
  },
  tabButtonText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: '#0F172A',
  },
});
