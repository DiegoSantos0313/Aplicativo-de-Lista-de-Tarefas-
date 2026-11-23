import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { StatusBar } from 'expo-status-bar';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth, db, firebaseReady } from './src/firebase';
import { cancelTaskReminder, scheduleTaskReminder } from './src/notifications';

const PRIORITIES = {
  alta: { label: 'Alta', color: '#D85050', background: '#FCE9E8', weight: 0 },
  media: { label: 'Média', color: '#B77A1C', background: '#FFF3D9', weight: 1 },
  baixa: { label: 'Baixa', color: '#387C64', background: '#E4F3EC', weight: 2 },
};

const FILTERS = [
  { key: 'todas', label: 'Todas' },
  { key: 'abertas', label: 'A fazer' },
  { key: 'concluidas', label: 'Concluídas' },
];

function formatReminder(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getErrorMessage(error) {
  const messages = {
    'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/invalid-email': 'Informe um e-mail válido.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/network-request-failed': 'Sem conexão. Verifique sua internet e tente novamente.',
  };
  return messages[error.code] || 'Não foi possível concluir. Tente novamente.';
}

function ActionButton({ label, onPress, variant = 'primary', disabled = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.secondaryButton,
        variant === 'danger' && styles.dangerButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
      ]}
    >
      <Text style={[styles.buttonText, variant === 'secondary' && styles.secondaryButtonText]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SetupScreen() {
  return (
    <SafeAreaView style={styles.centeredScreen}>
      <StatusBar style="dark" />
      <Text style={styles.eyebrow}>LISTA</Text>
      <Text style={styles.setupTitle}>Conecte seu Firebase</Text>
      <Text style={styles.setupBody}>
        Crie um arquivo .env a partir do .env.example e preencha as credenciais do seu projeto
        Firebase. Consulte o README para configurar Authentication e Firestore.
      </Text>
    </SafeAreaView>
  );
}

function AuthScreen() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    setBusy(true);
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.centeredScreen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.authCard}
      >
        <Text style={styles.eyebrow}>SEU DIA, NO SEU RITMO</Text>
        <Text style={styles.authTitle}>Organize o que importa.</Text>
        <Text style={styles.mutedText}>
          Entre na sua conta para acessar suas tarefas em qualquer lugar.
        </Text>
        {isRegistering && (
            <Text style={styles.registrationHint}>Sua conta será criada com este e-mail.</Text>
          )}
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="E-mail"
          placeholderTextColor="#8B918F"
          style={styles.input}
          value={email}
        />
        <TextInput
          autoCapitalize="none"
          autoComplete={isRegistering ? 'new-password' : 'password'}
          onChangeText={setPassword}
          placeholder="Senha (mínimo 6 caracteres)"
          placeholderTextColor="#8B918F"
          secureTextEntry
          style={styles.input}
          value={password}
        />
        {!!error && <Text style={styles.errorText}>{error}</Text>}
        <ActionButton
          disabled={busy || !email.trim() || !password}
          label={busy ? 'Aguarde...' : isRegistering ? 'Criar conta' : 'Entrar'}
          onPress={submit}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setIsRegistering(!isRegistering);
            setError('');
          }}
          style={styles.textButton}
        >
          <Text style={styles.linkText}>
            {isRegistering ? 'Já tenho uma conta' : 'Criar uma conta'}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TaskCard({ task, onToggle, onDelete }) {
  const priority = PRIORITIES[task.priority] || PRIORITIES.media;
  const reminder = task.reminderAt?.toDate ? task.reminderAt.toDate() : null;

  return (
    <View style={[styles.taskCard, task.completed && styles.completedTaskCard]}>
      <Pressable
        accessibilityLabel={task.completed ? 'Reabrir tarefa' : 'Concluir tarefa'}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.completed }}
        onPress={() => onToggle(task)}
        style={[styles.checkbox, task.completed && styles.checkedBox]}
      >
        {task.completed && <Text style={styles.checkmark}>✓</Text>}
      </Pressable>
      <View style={styles.taskContent}>
        <Text style={[styles.taskTitle, task.completed && styles.completedTaskTitle]}>
          {task.title}
        </Text>
        {!!task.notes && <Text style={styles.taskNotes}>{task.notes}</Text>}
        <View style={styles.taskMeta}>
          <Text style={[styles.priorityTag, { color: priority.color, backgroundColor: priority.background }]}>
            {priority.label}
          </Text>
          {reminder && <Text style={styles.reminderText}>◷ {formatReminder(reminder)}</Text>}
        </View>
      </View>
      <Pressable
        accessibilityLabel="Excluir tarefa"
        accessibilityRole="button"
        onPress={() => onDelete(task)}
        style={styles.deleteButton}
      >
        <Text style={styles.deleteText}>×</Text>
      </Pressable>
    </View>
  );
}

function TasksScreen({ user }) {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState('media');
  const [filter, setFilter] = useState('todas');
  const [reminderAt, setReminderAt] = useState(null);
  const [pickerMode, setPickerMode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const tasksQuery = query(
      collection(db, 'users', user.uid, 'tasks'),
      orderBy('createdAt', 'desc'),
    );
    return onSnapshot(
      tasksQuery,
      (snapshot) => {
        setTasks(snapshot.docs.map((taskDoc) => ({ id: taskDoc.id, ...taskDoc.data() })));
        setError('');
      },
      (snapshotError) => {
        setError(snapshotError.message || 'Não foi possível carregar as tarefas.');
      },
    );
  }, [user.uid]);

  const visibleTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        if (filter === 'abertas') return !task.completed;
        if (filter === 'concluidas') return task.completed;
        return true;
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
        const priorityDifference =
          (PRIORITIES[a.priority]?.weight ?? 1) - (PRIORITIES[b.priority]?.weight ?? 1);
        if (priorityDifference !== 0) return priorityDifference;
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      });
  }, [filter, tasks]);

  async function createTask() {
    const cleanedTitle = title.trim();
    if (!cleanedTitle) {
      setError('Escreva um título para a tarefa.');
      return;
    }
    if (reminderAt && reminderAt <= new Date()) {
      setError('Escolha um horário futuro para o lembrete.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const taskRef = await addDoc(collection(db, 'users', user.uid, 'tasks'), {
        title: cleanedTitle,
        notes: notes.trim(),
        priority,
        completed: false,
        reminderAt,
        createdAt: serverTimestamp(),
      });
      if (reminderAt) {
        try {
          const scheduled = await scheduleTaskReminder(cleanedTitle, reminderAt);
          if (!scheduled) {
            Alert.alert('Tarefa salva', 'Ative as notificações para receber lembretes neste aparelho.');
          } else {
            await scheduled.save(user.uid, taskRef.id);
          }
        } catch (notificationError) {
          Alert.alert(
            'Tarefa salva sem lembrete',
            notificationError.message || 'Não foi possível agendar a notificação.',
          );
        }
      }
      setTitle('');
      setNotes('');
      setPriority('media');
      setReminderAt(null);
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível salvar a tarefa.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleTask(task) {
    setError('');
    try {
      await updateDoc(doc(db, 'users', user.uid, 'tasks', task.id), {
        completed: !task.completed,
      });
      if (!task.completed) await cancelTaskReminder(user.uid, task.id);
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível atualizar a tarefa.');
    }
  }

  async function handleSignOut() {
    try {
      await signOut(auth);
    } catch (requestError) {
      Alert.alert('Não foi possível sair', requestError.message || 'Tente novamente.');
    }
  }

  function confirmDelete(task) {
    Alert.alert('Excluir tarefa?', `“${task.title}” será removida permanentemente.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          setError('');
          try {
            await deleteDoc(doc(db, 'users', user.uid, 'tasks', task.id));
          } catch (requestError) {
            setError(requestError.message || 'Não foi possível excluir a tarefa.');
            return;
          }
          try {
            await cancelTaskReminder(user.uid, task.id);
          } catch (requestError) {
            Alert.alert(
              'Tarefa excluída',
              requestError.message || 'Não foi possível cancelar o lembrete deste aparelho.',
            );
          }
        },
      },
    ]);
  }

  function handlePickerChange(event, selectedDate) {
    if (event.type === 'dismissed' || !selectedDate) {
      setPickerMode(null);
      return;
    }
    if (pickerMode === 'date') {
      const nextDate = new Date(selectedDate);
      nextDate.setHours(9, 0, 0, 0);
      setReminderAt(nextDate);
      setPickerMode('time');
      return;
    }
    if (pickerMode === 'time') {
      const nextDate = new Date(reminderAt || new Date());
      nextDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
      setReminderAt(nextDate);
      setPickerMode(null);
    }
  }

  const openTasks = tasks.filter((task) => !task.completed).length;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>LISTA</Text>
          <Text style={styles.pageTitle}>Minhas tarefas</Text>
          <Text style={styles.mutedText}>
            {openTasks === 1 ? '1 tarefa em aberto' : `${openTasks} tarefas em aberto`}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={handleSignOut}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{(user.email || 'U')[0].toUpperCase()}</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Nova tarefa</Text>
            <TextInput
              onChangeText={setTitle}
              onSubmitEditing={createTask}
              placeholder="O que você precisa fazer?"
              placeholderTextColor="#8B918F"
              returnKeyType="done"
              style={styles.input}
              value={title}
            />
            <TextInput
              multiline
              onChangeText={setNotes}
              placeholder="Detalhes (opcional)"
              placeholderTextColor="#8B918F"
              style={[styles.input, styles.notesInput]}
              value={notes}
            />
            <Text style={styles.fieldLabel}>Prioridade</Text>
            <View style={styles.priorityOptions}>
              {Object.entries(PRIORITIES).map(([key, item]) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: priority === key }}
                  key={key}
                  onPress={() => setPriority(key)}
                  style={[
                    styles.priorityOption,
                    priority === key && { borderColor: item.color, backgroundColor: item.background },
                  ]}
                >
                  <Text style={[styles.priorityOptionText, { color: item.color }]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.reminderRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setPickerMode('date')}
                style={styles.reminderButton}
              >
                <Text style={styles.reminderButtonText}>
                  {reminderAt ? `◷ ${formatReminder(reminderAt)}` : '+ Adicionar lembrete'}
                </Text>
              </Pressable>
              {reminderAt && (
                <Pressable
                  accessibilityLabel="Remover lembrete"
                  accessibilityRole="button"
                  onPress={() => setReminderAt(null)}
                >
                  <Text style={styles.clearReminder}>Remover</Text>
                </Pressable>
              )}
            </View>
            {pickerMode && (
              <DateTimePicker
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={pickerMode === 'date' ? new Date() : undefined}
                mode={pickerMode}
                onChange={handlePickerChange}
                value={reminderAt || new Date()}
              />
            )}
            <ActionButton
              disabled={busy || !title.trim()}
              label={busy ? 'Salvando...' : 'Adicionar tarefa'}
              onPress={createTask}
            />
          </View>

          {!!error && <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>}

          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Sua lista</Text>
            <Text style={styles.taskCount}>{tasks.length}</Text>
          </View>
          <View style={styles.filterRow}>
            {FILTERS.map((item) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: filter === item.key }}
                key={item.key}
                onPress={() => setFilter(item.key)}
                style={[styles.filterButton, filter === item.key && styles.activeFilterButton]}
              >
                <Text style={[styles.filterText, filter === item.key && styles.activeFilterText]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {visibleTasks.length ? (
            <FlatList
              data={visibleTasks}
              keyExtractor={(task) => task.id}
              renderItem={({ item }) => (
                <TaskCard task={item} onDelete={confirmDelete} onToggle={toggleTask} />
              )}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {filter === 'concluidas' ? 'Nada concluído por enquanto' : 'Tudo em dia por aqui'}
              </Text>
              <Text style={styles.mutedText}>
                {filter === 'abertas' ? 'Adicione uma tarefa para começar.' : 'Suas tarefas aparecem aqui.'}
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    if (!firebaseReady) return undefined;
    return onAuthStateChanged(auth, setUser);
  }, []);

  if (!firebaseReady) return <SetupScreen />;
  if (user === undefined) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator color="#28634F" size="large" />
      </SafeAreaView>
    );
  }
  return user ? <TasksScreen user={user} /> : <AuthScreen />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F6F2' },
  centeredScreen: {
    flex: 1,
    backgroundColor: '#F5F6F2',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 36 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 20,
  },
  eyebrow: { color: '#387C64', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  pageTitle: { color: '#1C2C25', fontSize: 28, fontWeight: '800', marginTop: 6 },
  mutedText: { color: '#78817D', fontSize: 14, lineHeight: 21, marginTop: 4 },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#DDEBE3',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  avatarText: { color: '#28634F', fontSize: 17, fontWeight: '800' },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E8ECE8',
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 24,
    padding: 18,
  },
  sectionTitle: { color: '#1C2C25', fontSize: 18, fontWeight: '800' },
  input: {
    backgroundColor: '#F7F8F5',
    borderColor: '#E6EAE6',
    borderRadius: 12,
    borderWidth: 1,
    color: '#20322A',
    fontSize: 15,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  notesInput: { minHeight: 64, textAlignVertical: 'top' },
  fieldLabel: { color: '#51605A', fontSize: 13, fontWeight: '700', marginTop: 17 },
  priorityOptions: { flexDirection: 'row', gap: 9, marginTop: 9 },
  priorityOption: {
    alignItems: 'center',
    borderColor: '#E8ECE8',
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 9,
  },
  priorityOptionText: { fontSize: 13, fontWeight: '700' },
  reminderRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  reminderButton: { paddingVertical: 7 },
  reminderButtonText: { color: '#387C64', fontSize: 14, fontWeight: '700' },
  clearReminder: { color: '#8B5854', fontSize: 13, fontWeight: '600' },
  button: {
    alignItems: 'center',
    backgroundColor: '#28634F',
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  secondaryButton: { backgroundColor: '#E7EEE9' },
  dangerButton: { backgroundColor: '#A53D3D' },
  disabledButton: { opacity: 0.55 },
  pressedButton: { opacity: 0.85 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryButtonText: { color: '#28634F' },
  listHeader: { alignItems: 'center', flexDirection: 'row', gap: 9, marginBottom: 12 },
  taskCount: {
    backgroundColor: '#E4EBE5',
    borderRadius: 11,
    color: '#496257',
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 13 },
  filterButton: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  activeFilterButton: { backgroundColor: '#DDEBE3' },
  filterText: { color: '#7A8580', fontSize: 13, fontWeight: '700' },
  activeFilterText: { color: '#28634F' },
  taskCard: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#E9ECE8',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    padding: 14,
  },
  completedTaskCard: { opacity: 0.72 },
  checkbox: {
    alignItems: 'center',
    borderColor: '#B9C4BD',
    borderRadius: 7,
    borderWidth: 1.5,
    height: 23,
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
    width: 23,
  },
  checkedBox: { backgroundColor: '#387C64', borderColor: '#387C64' },
  checkmark: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  taskContent: { flex: 1 },
  taskTitle: { color: '#27372F', fontSize: 15, fontWeight: '700', lineHeight: 21 },
  completedTaskTitle: { color: '#7D8882', textDecorationLine: 'line-through' },
  taskNotes: { color: '#78817D', fontSize: 13, lineHeight: 19, marginTop: 4 },
  taskMeta: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 9 },
  priorityTag: { borderRadius: 7, fontSize: 11, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4 },
  reminderText: { color: '#78817D', fontSize: 12 },
  deleteButton: { paddingHorizontal: 4, paddingLeft: 10, paddingVertical: 1 },
  deleteText: { color: '#9AA39E', fontSize: 23, lineHeight: 24 },
  emptyState: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24 },
  emptyTitle: { color: '#405148', fontSize: 15, fontWeight: '700' },
  authCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 22 },
  authTitle: { color: '#1C2C25', fontSize: 30, fontWeight: '800', lineHeight: 37, marginTop: 10 },
  textButton: { alignItems: 'center', paddingTop: 18 },
  registrationHint: { color: '#78817D', fontSize: 13, marginTop: 12 },
  linkText: { color: '#387C64', fontSize: 14, fontWeight: '700' },
  errorText: { color: '#A53D3D', fontSize: 13, lineHeight: 19, marginTop: 10 },
  setupTitle: { color: '#1C2C25', fontSize: 27, fontWeight: '800', marginTop: 10 },
  setupBody: { color: '#68756E', fontSize: 15, lineHeight: 23, marginTop: 8 },
});
