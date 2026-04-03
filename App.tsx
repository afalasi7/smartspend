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
  { key: 'dashboard', label: 'Home' },
  { key: 'add', label: 'Add' },
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
  const totalThisMonth = expenses.reduce((sum, expense) => {
    if (expense.date.startsWith(monthKey)) {
      return sum + expense.amount;
    }

    return sum;
  }, 0);

  const recentExpenses = [...expenses]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const categoryTotals = categories
    .map((item) => ({
      category: item,
      total: expenses
        .filter((expense) => expense.category === item)
        .reduce((sum, expense) => sum + expense.amount, 0),
    }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 4);
  const topCategory = categoryTotals[0];
  const monthlyExpenseCount = expenses.filter((expense) => expense.date.startsWith(monthKey)).length;

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

    const expensePayload: Expense = {
      id: `${Date.now()}`,
      title: nextTitle,
      amount: value,
      category,
      date,
      note: note.trim(),
    };

    setAmount(value.toString());
    setEditingExpenseId(null);
    saveExpense(expensePayload);
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
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>Copilot x Linear direction</Text>
            <Text style={styles.headerTitle}>SmartSpend</Text>
          </View>
          <View style={styles.syncBadge}>
            <Text style={styles.syncText}>{isLoaded ? 'Saved on device' : 'Loading'}</Text>
          </View>
        </View>

        {activeTab === 'dashboard' ? (
          <>
            <View style={styles.primaryCard}>
              <Text style={styles.cardLabel}>Monthly spend</Text>
              <Text style={styles.totalValue}>${totalThisMonth.toFixed(2)}</Text>
              <Text style={styles.cardHint}>A focused snapshot of your current pace and spending pattern.</Text>
              <View style={styles.heroDivider} />
              <View style={styles.heroFooterRow}>
                <View>
                  <Text style={styles.heroFootLabel}>Top category</Text>
                  <Text style={styles.heroFootValue}>{topCategory?.category ?? 'None yet'}</Text>
                </View>
                <View>
                  <Text style={styles.heroFootLabel}>Entries</Text>
                  <Text style={styles.heroFootValue}>{monthlyExpenseCount}</Text>
                </View>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.miniStatCard}>
                <Text style={styles.miniStatLabel}>Average entry</Text>
                <Text style={styles.miniStatValue}>${monthlyExpenseCount ? (totalThisMonth / monthlyExpenseCount).toFixed(0) : '0'}</Text>
              </View>
              <View style={styles.miniStatCard}>
                <Text style={styles.miniStatLabel}>Saved mode</Text>
                <Text style={styles.miniStatValueSmall}>Offline</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Category breakdown</Text>
              {categoryTotals.length === 0 ? (
                <Text style={styles.mutedText}>Add your first expense to see the breakdown.</Text>
              ) : (
                categoryTotals.map((item) => (
                  <View key={item.category} style={styles.breakdownRow}>
                    <View>
                      <Text style={styles.metricLabel}>{item.category}</Text>
                      <Text style={styles.breakdownMeta}>Category total</Text>
                    </View>
                    <Text style={styles.metricValue}>${item.total.toFixed(2)}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.inlineHeader}>
                <Text style={styles.sectionTitle}>Recent expenses</Text>
                <Pressable onPress={() => setActiveTab('expenses')}>
                  <Text style={styles.linkText}>View all</Text>
                </Pressable>
              </View>
              {recentExpenses.length === 0 ? (
                <Text style={styles.mutedText}>No expenses yet. Add one from the Add tab.</Text>
              ) : (
                recentExpenses.map((expense) => (
                  <ExpenseRow
                    key={expense.id}
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
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{editingExpenseId ? 'Edit expense' : 'Add expense'}</Text>
            <Text style={styles.cardHint}>
              {editingExpenseId ? 'Update the selected expense.' : 'Add a new expense in a few seconds.'}
            </Text>

            <View style={styles.amountHeroCard}>
              <Text style={styles.amountHeroLabel}>Expense amount</Text>
              <Text style={styles.amountHeroValue}>${hasValidAmount ? numericAmount.toFixed(2) : '0.00'}</Text>
              <Text style={styles.amountHeroHint}>Choose a quick amount or enter a custom value.</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Quick amount</Text>
              <View style={styles.quickAmountGrid}>
                {quickAmounts.map((value) => {
                  const isActive = amount === value.toString();

                  return (
                    <Pressable
                      key={value}
                      onPress={() => handleQuickAmount(value)}
                      onLongPress={() => handleQuickSave(value)}
                      delayLongPress={300}
                      style={[styles.quickAmountButton, isActive && styles.quickAmountButtonActive]}
                    >
                      <Text style={[styles.quickAmountText, isActive && styles.quickAmountTextActive]}>
                        ${value}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.inlineActionsRow}>
              <Pressable
                disabled={!lastAddedExpense}
                onPress={handleUndoLastAdd}
                style={[styles.ghostActionButton, !lastAddedExpense && styles.ghostActionButtonDisabled]}
              >
                <Text style={[styles.ghostActionText, !lastAddedExpense && styles.ghostActionTextDisabled]}>
                  Undo last add
                </Text>
              </Pressable>
              <Pressable onPress={handleResetAll} style={styles.ghostActionButton}>
                <Text style={[styles.ghostActionText, styles.resetText]}>Reset all</Text>
              </Pressable>
            </View>

            <Text style={styles.helperText}>Press and hold a quick amount to save instantly after entering a title.</Text>

            <View style={styles.formSection}>
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
            </View>

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
                    <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                      {item}
                    </Text>
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
        ) : null}

        {activeTab === 'expenses' ? (
          <View style={styles.card}>
            <View style={styles.inlineHeader}>
              <Text style={styles.sectionTitle}>All expenses</Text>
              <Text style={styles.mutedText}>{expenses.length} items</Text>
            </View>
            {expenses.length === 0 ? (
              <View style={styles.emptyStateCard}>
                <Text style={styles.emptyStateTitle}>No expenses yet</Text>
                <Text style={styles.mutedText}>Start with a quick amount or add your first expense manually.</Text>
              </View>
            ) : (
              [...expenses]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((expense) => (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    onDelete={handleDeleteExpense}
                    onEdit={handleEditExpense}
                  />
                ))
            )}
          </View>
        ) : null}

        {activeTab === 'settings' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Settings</Text>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Mode</Text>
              <Text style={styles.metricValue}>Offline MVP</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Storage</Text>
              <Text style={styles.metricValue}>This device only</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Editing</Text>
              <Text style={styles.metricValue}>Enabled</Text>
            </View>
            <Text style={styles.cardHint}>
              Your expenses are stored locally on this device with no account or cloud sync.
            </Text>
            <Pressable
              onPress={() => {
                Alert.alert('Clear saved expenses', 'Delete all saved expenses from this device?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: () => {
                      resetForm();
                      setExpenses([]);
                    },
                  },
                ]);
              }}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Clear saved expenses</Text>
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
        placeholderTextColor="#8E8E93"
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function ExpenseRow({
  expense,
  onDelete,
  onEdit,
}: {
  expense: Expense;
  onDelete: (id: string) => void;
  onEdit: (expense: Expense) => void;
}) {
  return (
    <View style={styles.expenseRow}>
      <View style={styles.expenseTextBlock}>
        <Text style={styles.expenseTitle}>{expense.title}</Text>
        <Text style={styles.expenseMeta}>
          {expense.category} • {expense.date}
        </Text>
      </View>
      <View style={styles.expenseActions}>
        <Text style={styles.expenseAmount}>${expense.amount.toFixed(2)}</Text>
        <View style={styles.rowActions}>
          <Pressable onPress={() => onEdit(expense)}>
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
          <Pressable onPress={() => onDelete(expense.id)}>
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: '#0B1020',
  },
  content: {
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 120,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  primaryCard: {
    backgroundColor: '#111827',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1F2937',
    gap: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  heroDivider: {
    height: 1,
    backgroundColor: '#1F2937',
    marginVertical: 4,
  },
  heroFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroFootLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroFootValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  miniStatCard: {
    flex: 1,
    backgroundColor: '#121A2B',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    gap: 8,
  },
  miniStatLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  miniStatValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  miniStatValueSmall: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 22,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  amountHeroCard: {
    backgroundColor: '#151E31',
    borderRadius: 22,
    padding: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#243041',
  },
  amountHeroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#AEAEB2',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  amountHeroValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  amountHeroHint: {
    fontSize: 14,
    color: '#D1D5DB',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  cardLabel: {
    fontSize: 15,
    color: '#94A3B8',
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 42,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardHint: {
    fontSize: 14,
    lineHeight: 20,
    color: '#94A3B8',
  },
  mutedText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  syncBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  syncText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A5B4FC',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  breakdownMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  metricLabel: {
    fontSize: 15,
    color: '#E5E7EB',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  inlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A5B4FC',
  },
  fieldGroup: {
    gap: 8,
  },
  formSection: {
    gap: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  input: {
    height: 52,
    borderRadius: 14,
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
  quickAmountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickAmountButton: {
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0B1220',
  },
  quickAmountButtonActive: {
    backgroundColor: '#1D4ED8',
    borderColor: '#1D4ED8',
  },
  quickAmountText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  quickAmountTextActive: {
    color: '#FFFFFF',
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
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#0F172A',
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  secondaryButton: {
    marginTop: 8,
    backgroundColor: '#111827',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderWidth: 1,
    borderColor: '#334155',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  inlineActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ghostActionButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0B1220',
    paddingHorizontal: 12,
  },
  ghostActionButtonDisabled: {
    opacity: 0.45,
  },
  ghostActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  ghostActionTextDisabled: {
    color: '#8E8E93',
  },
  resetText: {
    color: '#FF3B30',
  },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  expenseTextBlock: {
    flex: 1,
    paddingRight: 16,
    gap: 4,
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  expenseMeta: {
    fontSize: 13,
    color: '#94A3B8',
  },
  expenseActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  expenseAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  rowActions: {
    flexDirection: 'row',
    gap: 12,
  },
  editText: {
    fontSize: 13,
    color: '#A5B4FC',
    fontWeight: '600',
  },
  deleteText: {
    fontSize: 13,
    color: '#FF3B30',
    fontWeight: '600',
  },
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15,23,42,0.96)',
    padding: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
  },
  tabButtonActive: {
    backgroundColor: '#F8FAFC',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabButtonTextActive: {
    color: '#0F172A',
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#64748B',
  },
  emptyStateCard: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    gap: 6,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
});
