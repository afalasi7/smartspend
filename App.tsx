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
const quickAmounts = [5, 10, 20, 50, 100, 250];
const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'dashboard', label: 'Home' },
  { key: 'add', label: 'Add' },
  { key: 'expenses', label: 'Activity' },
  { key: 'settings', label: 'Settings' },
];

const categoryColors: Record<string, { tint: string; soft: string }> = {
  Food: { tint: '#F97316', soft: '#FFEDD5' },
  Transport: { tint: '#3B82F6', soft: '#DBEAFE' },
  Shopping: { tint: '#8B5CF6', soft: '#EDE9FE' },
  Bills: { tint: '#0F766E', soft: '#CCFBF1' },
  Health: { tint: '#EF4444', soft: '#FEE2E2' },
  Travel: { tint: '#D97706', soft: '#FEF3C7' },
};

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
  const recentExpenses = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
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

    saveExpense({
      id: editingExpenseId ?? `${Date.now()}`,
      title: title.trim(),
      amount: parsedAmount,
      category,
      date,
      note: note.trim(),
    });
  };

  const handleQuickAmount = (value: number) => {
    setAmount(value.toString());
  };

  const handleQuickAdd = (value: number) => {
    if (!title.trim()) {
      setTitle(category);
    }

    saveExpense({
      id: `${Date.now()}`,
      title: title.trim() || category,
      amount: value,
      category,
      date,
      note: note.trim(),
    });
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
        <View style={styles.topbar}>
          <View>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <View style={styles.brandDot} />
              </View>
              <Text style={styles.brandText}>SmartSpend</Text>
            </View>
            <Text style={styles.headline}>A cleaner way to track daily spending.</Text>
          </View>
          <View style={styles.syncPill}>
            <Text style={styles.syncPillText}>{isLoaded ? 'Saved locally' : 'Loading'}</Text>
          </View>
        </View>

        <View style={styles.quickAddCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick add</Text>
            <Text style={styles.sectionMeta}>One tap</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickAddRail}>
            {quickAmounts.map((value) => (
              <Pressable key={value} onPress={() => handleQuickAdd(value)} style={styles.quickAddPill}>
                <Text style={styles.quickAddPillText}>+ ${value}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {lastAddedExpense ? (
            <View style={styles.undoRow}>
              <Text style={styles.undoText}>Last add: {lastAddedExpense.title}</Text>
              <Pressable onPress={handleUndoLastAdd}>
                <Text style={styles.undoLink}>Undo</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {activeTab === 'dashboard' ? (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>This month</Text>
              <Text style={styles.heroAmount}>${totalThisMonth.toFixed(2)}</Text>
              <Text style={styles.heroText}>
                {monthlyExpenseCount === 0
                  ? 'No entries yet. Start with quick add above.'
                  : `${monthlyExpenseCount} expenses tracked this month.`}
              </Text>
              <View style={styles.heroStatsRow}>
                <SummaryChip label="Average" value={`$${averageExpense.toFixed(0)}`} />
                <SummaryChip label="Top" value={topCategory?.category ?? 'None'} />
              </View>
            </View>

            <View style={styles.summaryGrid}>
              <SoftStatCard label="Transactions" value={`${monthlyExpenseCount}`} subtitle="This month" />
              <SoftStatCard label="Saved mode" value="Offline" subtitle="Private to device" />
            </View>

            <View style={styles.surfaceCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Spending by category</Text>
                <Text style={styles.sectionMeta}>Monthly</Text>
              </View>
              {categoryTotals.length === 0 ? (
                <EmptyState title="Nothing here yet" text="Your category mix appears after you add a few expenses." />
              ) : (
                categoryTotals.slice(0, 4).map((item) => (
                  <CategoryRow key={item.category} category={item.category} total={item.total} max={categoryTotals[0].total} />
                ))
              )}
            </View>

            <View style={styles.surfaceCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent activity</Text>
                <Pressable onPress={() => setActiveTab('expenses')}>
                  <Text style={styles.inlineLink}>See all</Text>
                </Pressable>
              </View>
              {recentExpenses.length === 0 ? (
                <EmptyState title="No expenses yet" text="Capture your first expense from the Add tab or quick add strip." />
              ) : (
                recentExpenses.slice(0, 3).map((expense) => (
                  <ExpenseCard key={expense.id} compact expense={expense} onDelete={handleDeleteExpense} onEdit={handleEditExpense} />
                ))
              )}
            </View>
          </>
        ) : null}

        {activeTab === 'add' ? (
          <>
            <View style={styles.addPreviewCard}>
              <Text style={styles.addPreviewLabel}>{editingExpenseId ? 'Editing expense' : 'New expense'}</Text>
              <Text style={styles.addPreviewAmount}>${hasValidAmount ? numericAmount.toFixed(2) : '0.00'}</Text>
              <Text style={styles.addPreviewText}>Set the amount quickly, then adjust the details below.</Text>
            </View>

            <View style={styles.surfaceCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Amount picker</Text>
                <Text style={styles.sectionMeta}>Tap to fill</Text>
              </View>
              <View style={styles.amountGrid}>
                {quickAmounts.map((value) => {
                  const isActive = amount === value.toString();
                  return (
                    <Pressable
                      key={value}
                      onPress={() => handleQuickAmount(value)}
                      style={[styles.amountButton, isActive && styles.amountButtonActive]}
                    >
                      <Text style={[styles.amountButtonText, isActive && styles.amountButtonTextActive]}>${value}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.surfaceCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Expense details</Text>
                <Text style={styles.sectionMeta}>Manual</Text>
              </View>
              <Field label="Title" value={title} onChangeText={setTitle} placeholder="Groceries" />
              <Field label="Amount" value={amount} onChangeText={setAmount} placeholder="45.90" keyboardType="decimal-pad" />
              <Field label="Date" value={date} onChangeText={setDate} placeholder="2026-04-03" />
              <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional note" />
              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.categoryWrap}>
                {categories.map((item) => {
                  const isActive = item === category;
                  return (
                    <Pressable key={item} onPress={() => setCategory(item)} style={[styles.categoryChip, isActive && styles.categoryChipActive]}>
                      <View style={[styles.categoryDot, { backgroundColor: categoryColors[item].tint }]} />
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
          <View style={styles.surfaceCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Activity</Text>
              <Text style={styles.sectionMeta}>{expenses.length} items</Text>
            </View>
            {expenses.length === 0 ? (
              <EmptyState title="No activity yet" text="Your timeline will show each expense after you add it." />
            ) : (
              [...expenses]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((expense) => <ExpenseCard key={expense.id} expense={expense} onDelete={handleDeleteExpense} onEdit={handleEditExpense} />)
            )}
          </View>
        ) : null}

        {activeTab === 'settings' ? (
          <View style={styles.surfaceCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Settings</Text>
              <Text style={styles.sectionMeta}>Simple MVP</Text>
            </View>
            <SettingRow label="Mode" value="Offline" />
            <SettingRow label="Storage" value="Device only" />
            <SettingRow label="Quick add" value="Enabled" />
            <SettingRow label="Brand" value="SmartSpend" />
            <Text style={styles.settingsText}>This version stays intentionally small while we refine the product feel.</Text>
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
            <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={[styles.tabButton, isActive && styles.tabButtonActive]}>
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
        placeholderTextColor="#9CA3AF"
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryChip}>
      <Text style={styles.summaryChipLabel}>{label}</Text>
      <Text style={styles.summaryChipValue}>{value}</Text>
    </View>
  );
}

function SoftStatCard({ label, value, subtitle }: { label: string; value: string; subtitle: string }) {
  return (
    <View style={styles.softStatCard}>
      <Text style={styles.softStatLabel}>{label}</Text>
      <Text style={styles.softStatValue}>{value}</Text>
      <Text style={styles.softStatSubtitle}>{subtitle}</Text>
    </View>
  );
}

function CategoryRow({ category, total, max }: { category: string; total: number; max: number }) {
  const width = (max === 0 ? '0%' : `${Math.max(10, Math.round((total / max) * 100))}%`) as `${number}%`;
  const colors = categoryColors[category];

  return (
    <View style={styles.categoryRow}>
      <View style={styles.categoryRowHeader}>
        <View style={styles.categoryTitleRow}>
          <View style={[styles.categoryDot, { backgroundColor: colors.tint }]} />
          <Text style={styles.categoryRowTitle}>{category}</Text>
        </View>
        <Text style={styles.categoryRowAmount}>${total.toFixed(2)}</Text>
      </View>
      <View style={styles.categoryTrack}>
        <View style={[styles.categoryFill, { width, backgroundColor: colors.tint }]} />
      </View>
    </View>
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
  const colors = categoryColors[expense.category];

  return (
    <View style={[styles.expenseCard, compact && styles.expenseCardCompact]}>
      <View style={[styles.expenseIconBubble, { backgroundColor: colors.soft }]}>
        <View style={[styles.expenseIconDot, { backgroundColor: colors.tint }]} />
      </View>
      <View style={styles.expenseMain}>
        <View style={styles.expenseTopRow}>
          <Text style={styles.expenseTitle}>{expense.title}</Text>
          <Text style={styles.expenseAmount}>-${expense.amount.toFixed(2)}</Text>
        </View>
        <View style={styles.expenseMetaRow}>
          <Text style={styles.expenseCategory}>{expense.category}</Text>
          <Text style={styles.expenseDate}>{expense.date}</Text>
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
    backgroundColor: '#F6F1E8',
  },
  content: {
    paddingTop: 54,
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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#86EFAC',
  },
  brandText: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
  },
  headline: {
    marginTop: 10,
    color: '#4B5563',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 260,
  },
  syncPill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E7E0D4',
  },
  syncPillText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
  },
  quickAddCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E9E2D8',
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
  },
  sectionMeta: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  quickAddRail: {
    gap: 10,
    paddingRight: 8,
  },
  quickAddPill: {
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  quickAddPillText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  undoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  undoText: {
    color: '#6B7280',
    fontSize: 13,
  },
  undoLink: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: '#111827',
    borderRadius: 32,
    padding: 24,
    gap: 10,
  },
  heroLabel: {
    color: '#C7D2FE',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  heroAmount: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '700',
  },
  heroText: {
    color: '#CBD5E1',
    fontSize: 15,
    lineHeight: 22,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  summaryChip: {
    flex: 1,
    backgroundColor: '#1F2937',
    borderRadius: 18,
    padding: 14,
    gap: 4,
  },
  summaryChipLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
  },
  summaryChipValue: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  softStatCard: {
    flex: 1,
    backgroundColor: '#FFFDF9',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E9E2D8',
    gap: 5,
  },
  softStatLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  softStatValue: {
    color: '#111827',
    fontSize: 30,
    fontWeight: '700',
  },
  softStatSubtitle: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  surfaceCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E9E2D8',
    gap: 14,
  },
  inlineLink: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  categoryRow: {
    gap: 8,
  },
  categoryRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  categoryRowTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },
  categoryRowAmount: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  categoryTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#F1EADF',
    overflow: 'hidden',
  },
  categoryFill: {
    height: '100%',
    borderRadius: 999,
  },
  emptyState: {
    borderRadius: 20,
    backgroundColor: '#FAF6EF',
    padding: 18,
    gap: 6,
  },
  emptyTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 20,
  },
  addPreviewCard: {
    backgroundColor: '#F5EBDD',
    borderRadius: 28,
    padding: 22,
    gap: 8,
  },
  addPreviewLabel: {
    color: '#7C2D12',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  addPreviewAmount: {
    color: '#111827',
    fontSize: 42,
    fontWeight: '700',
  },
  addPreviewText: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 20,
  },
  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  amountButton: {
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: '#FAF6EF',
  },
  amountButtonActive: {
    backgroundColor: '#111827',
  },
  amountButtonText: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '700',
  },
  amountButtonTextActive: {
    color: '#FFFFFF',
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    height: 54,
    borderRadius: 18,
    backgroundColor: '#FAF6EF',
    paddingHorizontal: 16,
    color: '#111827',
    fontSize: 16,
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#FAF6EF',
  },
  categoryChipActive: {
    backgroundColor: '#111827',
  },
  categoryChipText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '700',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  primaryButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 52,
    borderRadius: 18,
    backgroundColor: '#FAF6EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
  expenseCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#FAF6EF',
  },
  expenseCardCompact: {
    paddingVertical: 14,
  },
  expenseIconBubble: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseIconDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
  },
  expenseMain: {
    flex: 1,
    gap: 6,
  },
  expenseTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  expenseTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  expenseAmount: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
  expenseMetaRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  expenseCategory: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  expenseDate: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  expenseNote: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 18,
  },
  expenseActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minWidth: 50,
    gap: 8,
  },
  editText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteText: {
    color: '#DC2626',
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
    color: '#6B7280',
    fontSize: 15,
  },
  settingValue: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
  settingsText: {
    color: '#6B7280',
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
    backgroundColor: 'rgba(255,253,249,0.96)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E9E2D8',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 16,
  },
  tabButtonActive: {
    backgroundColor: '#111827',
  },
  tabButtonText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
});
