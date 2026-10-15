export const LESSONS = [
  {
    id: 'stack',
    title: 'Stack',
    subtitle: 'LAST IN · FIRST OUT',
    color: '#f4ac72',
    x: -4.5,
    z: -4,
    meaning: 'The last item added is the first item removed.',
    task: 'Push two crates, then pop. Predict which crate leaves first.',
    actions: [
      ['push', 'PUSH +'],
      ['pop', 'POP −'],
    ],
    question: 'You push A, then B, then C. Which item does POP remove?',
    options: ['A', 'B', 'C'],
    correct: 2,
    explanation: 'C was added last and is on top. A stack removes its top item first.',
  },
  {
    id: 'queue',
    title: 'Queue',
    subtitle: 'FIRST IN · FIRST OUT',
    color: '#74d5f0',
    x: 0,
    z: -4,
    meaning: 'Items leave in the same order they arrived.',
    task: 'Add arrivals to the conveyor. Serve the person who arrived first.',
    actions: [
      ['enqueue', 'JOIN +'],
      ['dequeue', 'SERVE →'],
    ],
    question: 'A, B and C join a queue in that order. Who is served first?',
    options: ['C', 'A', 'B'],
    correct: 1,
    explanation: 'A arrived first. A queue removes from its front.',
  },
  {
    id: 'cache',
    title: 'Cache',
    subtitle: 'KEEP A FAST COPY',
    color: '#af9aff',
    x: 4.5,
    z: -4,
    meaning: 'A small fast store keeps reusable data for later requests.',
    task: 'Request the same data twice. Watch the source change from the distant store to the nearby cache.',
    actions: [
      ['request', 'REQUEST'],
      ['clear', 'CLEAR'],
    ],
    question: 'Why can a second request be faster after the first request fills a cache?',
    options: [
      'Data stops existing',
      'A nearby reusable copy is available',
      'Every calculation becomes free',
    ],
    correct: 1,
    explanation:
      'The reusable copy avoids fetching the same data again from the slower source. A cache does not make all work free.',
  },
  {
    id: 'recursion',
    title: 'Recursion',
    subtitle: 'SMALLER CASE · BASE CASE',
    color: '#79dfb2',
    x: -4.5,
    z: 1.2,
    meaning:
      'A function calls itself with a smaller problem until it reaches a base case, then returns.',
    task: 'Step through factorial(3). Each frame waits for a smaller call; the base case lets them return.',
    actions: [
      ['step', 'STEP →'],
      ['reset', 'RESTART'],
    ],
    question: 'What stops a correctly designed recursive function from calling itself forever?',
    options: ['A base case', 'Its name', 'More memory'],
    correct: 0,
    explanation:
      'The function must reach a base case. In this example factorial(1) returns 1, allowing the waiting calls to return.',
  },
  {
    id: 'deadlock',
    title: 'Deadlock',
    subtitle: 'A CYCLE OF WAITING',
    color: '#f78b9e',
    x: 0,
    z: 1.2,
    meaning:
      'Tasks can become stuck when each holds a resource and waits for another task’s resource.',
    task: 'Let each robot take one key. Then request the other key. Break the cycle by releasing a held key.',
    actions: [
      ['step', 'NEXT STEP'],
      ['release', 'RELEASE'],
    ],
    question:
      'Robot A holds key 1 and waits for key 2. B holds key 2 and waits for key 1. What is happening?',
    options: ['Caching', 'Deadlock', 'A successful queue'],
    correct: 1,
    explanation:
      'Neither task can progress because each waits for the other. Releasing a held resource can break this example’s cycle.',
  },
  {
    id: 'semaphore',
    title: 'Semaphore',
    subtitle: 'TWO PERMITS · SHARED SPACE',
    color: '#ffe09a',
    x: 4.5,
    z: 1.2,
    meaning: 'Permits limit how many tasks can use a shared resource at once.',
    task: 'Admit three tasks to a two-permit workshop. The third must wait until a task exits.',
    actions: [
      ['enter', 'ENTER +'],
      ['leave', 'EXIT −'],
    ],
    question:
      'A semaphore has two permits, both in use. What must the next task do before entering?',
    options: ['Ignore the limit', 'Create a new permit', 'Wait for a released permit'],
    correct: 2,
    explanation:
      'A task acquires a permit before entering. When a task leaves, it releases its permit for another task.',
  },
];

export const lessonById = (id) => LESSONS.find((lesson) => lesson.id === id);
export const initialExhibit = (id) => ({
  id,
  items: [],
  next: 1,
  step: 0,
  hits: 0,
  cached: false,
  waiting: 0,
  message: lessonById(id).task,
});

export function interact(previous, action) {
  const state = structuredClone(previous);
  const lesson = lessonById(state.id);
  if (!lesson?.actions.some(([id]) => id === action)) throw new Error('Unknown exhibit action.');
  if (state.id === 'stack' || state.id === 'queue') {
    const adding = action === 'push' || action === 'enqueue';
    if (adding) {
      if (state.items.length === 5) {
        state.message = 'This demonstration holds five items. Remove one before adding another.';
        return state;
      }
      const item = state.next++;
      state.items.push(item);
      state.message = `Item ${item} added ${state.id === 'stack' ? 'on top' : 'at the back'}. Predict which item leaves next.`;
    } else {
      const item = state.id === 'stack' ? state.items.pop() : state.items.shift();
      state.message =
        item === undefined
          ? 'It is empty. Add some items first.'
          : `Item ${item} left ${state.id === 'stack' ? 'from the top: last in, first out.' : 'from the front: first in, first out.'}`;
    }
  } else if (state.id === 'cache') {
    if (action === 'clear') {
      state.cached = false;
      state.hits = 0;
      state.message = 'Cache cleared. The next request must fetch from the distant store.';
    } else if (!state.cached) {
      state.cached = true;
      state.message =
        'MISS → fetch from the distant store → keep a copy in the cache. Request again.';
    } else {
      state.hits++;
      state.message = `HIT ${state.hits} → return the nearby copy. This illustrates the path, not measured performance.`;
    }
  } else if (state.id === 'recursion') {
    state.step = action === 'reset' ? 0 : (state.step + 1) % 6;
    state.message = [
      'factorial(3): begin with the original problem.',
      'factorial(3) waits for 3 × factorial(2).',
      'factorial(2) waits for 2 × factorial(1).',
      'Base case: factorial(1) returns 1. No smaller call needed.',
      'Return: factorial(2) = 2 × 1 = 2.',
      'Return: factorial(3) = 3 × 2 = 6.',
    ][state.step];
  } else if (state.id === 'deadlock') {
    state.step = action === 'release' ? 0 : Math.min(2, state.step + 1);
    state.message =
      action === 'release'
        ? 'A releases key 1. B can finish, release key 2, and let A try again.'
        : [
            'Both robots are ready.',
            'A holds key 1. B holds key 2. Each still needs the other key.',
            'DEADLOCK: A waits for B’s key, and B waits for A’s key. Release breaks this example’s cycle.',
          ][state.step];
  } else if (state.id === 'semaphore') {
    if (action === 'enter') {
      if (state.items.length < 2) {
        state.items.push(state.next++);
        state.message = `Permit acquired. ${state.items.length}/2 places occupied.`;
      } else {
        state.waiting = 1;
        state.message = 'No free permit. The third task waits outside; the limit stays at two.';
      }
    } else if (!state.items.length) state.message = 'The workshop is empty. Admit a task first.';
    else {
      state.items.shift();
      if (state.waiting) {
        state.items.push(state.next++);
        state.waiting = 0;
        state.message =
          'One permit released, then acquired by the waiting task. Two tasks remain inside.';
      } else state.message = `Permit released. ${2 - state.items.length} permit(s) available.`;
    }
  }
  return state;
}

export function gradeChoice(question, choice) {
  if (!Number.isInteger(choice) || choice < 0 || choice >= question.options.length)
    throw new Error('Choose a listed answer.');
  return { correct: choice === question.correct, explanation: question.explanation };
}
